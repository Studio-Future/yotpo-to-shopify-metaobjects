export class ProductMapper {
  constructor(shopifyClient) {
    this.shopifyClient = shopifyClient;
    this.skuToProductCache = new Map(); // variant SKU → product
    this.idToProductCache = new Map();  // product ID (numeric) → product
    this.cacheFetched = false;
  }

  /**
   * Extracts numeric ID from Shopify GID
   * e.g., "gid://shopify/Product/7948135825645" → "7948135825645"
   */
  extractNumericId(gid) {
    if (!gid) return null;
    const parts = gid.split('/');
    return parts[parts.length - 1];
  }

  /**
   * Fetches all products with variants and builds multiple lookup maps
   */
  async buildProductCache() {
    if (this.cacheFetched) {
      return;
    }

    console.log('Building product lookup cache (SKU + ID)...');

    const query = `
      query GetProducts($cursor: String) {
        products(first: 250, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          edges {
            node {
              id
              title
              variants(first: 100) {
                edges {
                  node {
                    id
                    sku
                  }
                }
              }
            }
          }
        }
      }
    `;

    let hasNextPage = true;
    let cursor = null;
    let totalProducts = 0;
    let pageCount = 0;

    while (hasNextPage) {
      pageCount++;

      try {
        const data = await this.shopifyClient.graphqlRequest(query, { cursor });

        const productsInBatch = data.products.edges.length;

        data.products.edges.forEach(({ node: product }) => {
          const productData = {
            productId: product.id,
            productTitle: product.title,
            variantIds: [],
          };

          // Extract numeric ID for Yotpo matching
          const numericId = this.extractNumericId(product.id);
          if (numericId) {
            this.idToProductCache.set(numericId, productData);
          }

          // Also map by variant SKUs
          product.variants.edges.forEach(({ node: variant }) => {
            productData.variantIds.push(variant.id);

            if (variant.sku) {
              this.skuToProductCache.set(variant.sku, productData);
            }
          });

          totalProducts++;
        });

        hasNextPage = data.products.pageInfo.hasNextPage;
        cursor = data.products.pageInfo.endCursor;

        // Log progress
        console.log(`  Fetched page ${pageCount}: ${productsInBatch} products (total: ${totalProducts})`);

        // Rate limiting: pause between requests to avoid throttling
        if (hasNextPage) {
          await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
        }
      } catch (error) {
        console.error(`  Error fetching page ${pageCount}:`, error.message);
        throw error;
      }
    }

    this.cacheFetched = true;
    console.log(`✓ Cached ${totalProducts} products:`);
    console.log(`  - ${this.skuToProductCache.size} variant SKUs`);
    console.log(`  - ${this.idToProductCache.size} product IDs\n`);
  }

  /**
   * Looks up Shopify product by Yotpo "SKU" (which might be SKU or product ID)
   * @param {string} yotpoSku - Yotpo SKU field (could be variant SKU or product ID)
   * @returns {string|null} - Shopify product GID or null
   */
  getProductIdBySku(yotpoSku) {
    if (!yotpoSku || yotpoSku === 'yotpo_site_reviews') {
      return null;
    }

    // Try variant SKU lookup first
    let match = this.skuToProductCache.get(yotpoSku);
    if (match) {
      return match.productId;
    }

    // Try product ID lookup (Yotpo might store Shopify product IDs as "SKU")
    match = this.idToProductCache.get(yotpoSku);
    if (match) {
      return match.productId;
    }

    return null;
  }

  /**
   * Gets product details by Yotpo SKU/ID
   * @param {string} yotpoSku - Yotpo SKU field
   * @returns {object|null} - Product details or null
   */
  getProductDetailsBySku(yotpoSku) {
    if (!yotpoSku || yotpoSku === 'yotpo_site_reviews') {
      return null;
    }

    // Try variant SKU lookup first
    let match = this.skuToProductCache.get(yotpoSku);
    if (match) {
      return { ...match, matchType: 'variant_sku' };
    }

    // Try product ID lookup
    match = this.idToProductCache.get(yotpoSku);
    if (match) {
      return { ...match, matchType: 'product_id' };
    }

    return null;
  }

  /**
   * Gets cache statistics
   */
  getCacheStats() {
    return {
      totalSkus: this.skuToProductCache.size,
      totalProductIds: this.idToProductCache.size,
      isFetched: this.cacheFetched,
    };
  }

  /**
   * Clears the cache (useful for re-syncing)
   */
  clearCache() {
    this.skuToProductCache.clear();
    this.idToProductCache.clear();
    this.cacheFetched = false;
  }
}
