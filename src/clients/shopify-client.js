import fetch from 'node-fetch';

export class ShopifyClient {
  constructor(shopUrl, accessToken, apiVersion = '2025-07') {
    this.shopUrl = shopUrl;
    this.accessToken = accessToken;
    this.apiVersion = apiVersion;
    this.graphqlUrl = `https://${shopUrl}/admin/api/${apiVersion}/graphql.json`;
  }

  async graphqlRequest(query, variables = {}) {
    const response = await fetch(this.graphqlUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': this.accessToken,
      },
      body: JSON.stringify({
        query,
        variables,
      }),
    });

    if (!response.ok) {
      throw new Error(`Shopify API request failed: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    return data.data;
  }

  async createMetaobject(type, fields) {
    const mutation = `
      mutation CreateMetaobject($metaobject: MetaobjectCreateInput!) {
        metaobjectCreate(metaobject: $metaobject) {
          metaobject {
            id
            handle
            type
            fields {
              key
              value
            }
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `;

    const variables = {
      metaobject: {
        type,
        capabilities: {
          publishable: {
            status: 'ACTIVE'
          }
        },
        fields,
      },
    };

    const result = await this.graphqlRequest(mutation, variables);
    return result.metaobjectCreate;
  }

  async updateMetaobject(metaobjectId, fields) {
    const mutation = `
      mutation UpdateMetaobject($id: ID!, $metaobject: MetaobjectUpdateInput!) {
        metaobjectUpdate(id: $id, metaobject: $metaobject) {
          metaobject {
            id
            handle
            fields {
              key
              value
            }
          }
          userErrors {
            field
            message
            code
          }
        }
      }
    `;

    const variables = {
      id: metaobjectId,
      metaobject: {
        fields,
      },
    };

    const result = await this.graphqlRequest(mutation, variables);
    return result.metaobjectUpdate;
  }

  async findMetaobjectByYotpoId(type, yotpoId) {
    const query = `
      query FindMetaobjectByYotpoId($type: String!, $first: Int!) {
        metaobjects(type: $type, first: $first) {
          edges {
            node {
              id
              handle
              fields {
                key
                value
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    // Note: Shopify doesn't support filtering by field value in the query,
    // so we need to fetch and filter client-side

    let hasNextPage = true;
    let cursor = null;
    const batchSize = 250; // Max

    while (hasNextPage) {
      const variables = {
        type,
        first: batchSize,
        after: cursor,
      };

      const data = await this.graphqlRequest(query, variables);
      const metaobjects = data.metaobjects.edges.map(edge => edge.node);

      // Find matching metaobject by yotpo_id field
      const match = metaobjects.find(obj => {
        const idField = obj.fields.find(f => f.key === 'yotpo_id');
        return idField && idField.value === yotpoId.toString();
      });

      if (match) {
        return match;
      }

      hasNextPage = data.metaobjects.pageInfo.hasNextPage;
      cursor = data.metaobjects.pageInfo.endCursor;

      if (!hasNextPage) {
        break;
      }
    }

    return null;
  }

  async upsertMetaobject(type, yotpoId, fields) {
    // Try to find existing metaobject
    const existing = await this.findMetaobjectByYotpoId(type, yotpoId);

    if (existing) {
      // Update existing
      return {
        result: await this.updateMetaobject(existing.id, fields),
        operation: 'updated',
      };
    } else {
      // Create new
      return {
        result: await this.createMetaobject(type, fields),
        operation: 'created',
      };
    }
  }

  async getMetaobjectStats(type) {
    const query = `
      query GetMetaobjectStats($type: String!) {
        metaobjects(type: $type, first: 1) {
          edges {
            node {
              id
            }
          }
        }
      }
    `;

    const data = await this.graphqlRequest(query, { type });
    // Note: GraphQL doesn't return total count, this is a limitation
    // We'd need to paginate through all to get accurate count
    return {
      type,
      // count: 'unknown', // Would need full pagination
    };
  }

  async getStatisticsMetaobjectBySku(sku) {
    const query = `
      query FindStatisticsBySku($type: String!, $first: Int!) {
        metaobjects(type: $type, first: $first) {
          edges {
            node {
              id
              handle
              fields {
                key
                value
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    let hasNextPage = true;
    let cursor = null;
    const batchSize = 250;

    while (hasNextPage) {
      const variables = {
        type: 'yotpo_review_statistics',
        first: batchSize,
        after: cursor,
      };

      const data = await this.graphqlRequest(query, variables);
      const metaobjects = data.metaobjects.edges.map(edge => edge.node);

      const match = metaobjects.find(obj => {
        const skuField = obj.fields.find(f => f.key === 'product_sku');
        return skuField && skuField.value === sku;
      });

      if (match) {
        return match;
      }

      hasNextPage = data.metaobjects.pageInfo.hasNextPage;
      cursor = data.metaobjects.pageInfo.endCursor;

      if (!hasNextPage) {
        break;
      }
    }

    return null;
  }

  async createStatisticsMetaobject(fields) {
    return this.createMetaobject('yotpo_review_statistics', fields);
  }

  async updateStatisticsMetaobject(metaobjectId, fields) {
    return this.updateMetaobject(metaobjectId, fields);
  }
}
