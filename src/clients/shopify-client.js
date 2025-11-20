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

  async buildMetaobjectCache(type) {
    // Build a cache of all existing metaobjects for fast lookups
    if (!this._metaobjectCache) {
      this._metaobjectCache = {};
    }

    if (this._metaobjectCache[type]) {
      return; // Already cached
    }

    console.log(`  Building cache for ${type} metaobjects...`);

    const query = `
      query FindMetaobjects($type: String!, $first: Int!, $after: String) {
        metaobjects(type: $type, first: $first, after: $after) {
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

    const cache = new Map();
    let hasNextPage = true;
    let cursor = null;
    const batchSize = 250;
    let totalFetched = 0;

    while (hasNextPage) {
      const variables = {
        type,
        first: batchSize,
        after: cursor,
      };

      const data = await this.graphqlRequest(query, variables);
      const metaobjects = data.metaobjects.edges.map(edge => edge.node);

      // Index by yotpo_id for fast lookup
      metaobjects.forEach(obj => {
        const idField = obj.fields.find(f => f.key === 'yotpo_id');
        if (idField) {
          cache.set(idField.value, obj);
        }
      });

      totalFetched += metaobjects.length;
      hasNextPage = data.metaobjects.pageInfo.hasNextPage;
      cursor = data.metaobjects.pageInfo.endCursor;

      // Small delay to avoid rate limiting
      if (hasNextPage) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    this._metaobjectCache[type] = cache;
    console.log(`  ✓ Cached ${totalFetched} existing ${type} metaobjects\n`);
  }

  async findMetaobjectByYotpoId(type, yotpoId) {
    // Use cache if available
    if (this._metaobjectCache && this._metaobjectCache[type]) {
      return this._metaobjectCache[type].get(yotpoId.toString()) || null;
    }

    // Fallback to old method if cache not built (shouldn't happen in normal flow)
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

    let hasNextPage = true;
    let cursor = null;
    const batchSize = 250;

    while (hasNextPage) {
      const variables = {
        type,
        first: batchSize,
        after: cursor,
      };

      const data = await this.graphqlRequest(query, variables);
      const metaobjects = data.metaobjects.edges.map(edge => edge.node);

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

  updateMetaobjectCache(type, yotpoId, metaobject) {
    // Update cache after create/update operations
    if (this._metaobjectCache && this._metaobjectCache[type]) {
      this._metaobjectCache[type].set(yotpoId.toString(), metaobject);
    }
  }

  async upsertMetaobject(type, yotpoId, fields) {
    // Try to find existing metaobject
    const existing = await this.findMetaobjectByYotpoId(type, yotpoId);

    if (existing) {
      // Update existing
      const result = await this.updateMetaobject(existing.id, fields);

      // Update cache
      if (result.metaobject) {
        this.updateMetaobjectCache(type, yotpoId, result.metaobject);
      }

      return {
        result,
        operation: 'updated',
      };
    } else {
      // Create new
      const result = await this.createMetaobject(type, fields);

      // Update cache
      if (result.metaobject) {
        this.updateMetaobjectCache(type, yotpoId, result.metaobject);
      }

      return {
        result,
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
