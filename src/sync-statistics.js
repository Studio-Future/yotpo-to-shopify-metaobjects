import 'dotenv/config';
import { YotpoClient } from './clients/yotpo-client.js';
import { ShopifyClient } from './clients/shopify-client.js';
import { calculateReviewStatistics, calculateGlobalStatistics, transformStatisticsToMetaobject } from './transformers/statistics-calculator.js';

export async function syncReviewStatistics(yotpoReviews = null, shopifyClient = null) {
  console.log('📊 Syncing review statistics to Shopify...\n');

  // Initialize clients if not provided
  const client = shopifyClient || new ShopifyClient(
    process.env.SHOPIFY_SHOP_URL,
    process.env.SHOPIFY_ACCESS_TOKEN,
    process.env.SHOPIFY_API_VERSION
  );

  let reviews = yotpoReviews;

  // Fetch reviews if not provided
  if (!reviews) {
    const yotpoClient = new YotpoClient(
      process.env.YOTPO_APP_KEY,
      process.env.YOTPO_APP_SECRET
    );

    console.log('📥 Fetching reviews from Yotpo...');
    reviews = await yotpoClient.fetchAllReviewsPaginated();
    console.log(`✓ Found ${reviews.length} reviews\n`);
  }

  // Calculate statistics per product
  const productStatistics = calculateReviewStatistics(reviews);
  const productSkus = Object.keys(productStatistics);

  if (productSkus.length === 0) {
    console.log('No product statistics to sync.');
    return { created: 0, updated: 0, errors: 0 };
  }

  console.log(`📊 Calculated statistics for ${productSkus.length} products\n`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (let i = 0; i < productSkus.length; i++) {
    const sku = productSkus[i];
    const stats = productStatistics[sku];

    try {
      // Check if statistics metaobject already exists for this SKU
      const existingMetaobject = await client.getStatisticsMetaobjectBySku(sku);

      // Transform statistics to metaobject fields
      const metaobjectFields = transformStatisticsToMetaobject(stats);

      if (existingMetaobject) {
        // Update existing metaobject
        const result = await client.updateStatisticsMetaobject(
          existingMetaobject.id,
          metaobjectFields
        );

        if (result.userErrors && result.userErrors.length > 0) {
          console.error(`❌ Error updating statistics for SKU ${sku}:`, result.userErrors);
          errors++;
        } else {
          console.log(`✓ Updated statistics for SKU ${sku} (${i + 1}/${productSkus.length})`);
          updated++;
        }
      } else {
        // Create new metaobject
        const result = await client.createStatisticsMetaobject(metaobjectFields);

        if (result.userErrors && result.userErrors.length > 0) {
          console.error(`❌ Error creating statistics for SKU ${sku}:`, result.userErrors);
          errors++;
        } else {
          console.log(`✓ Created statistics for SKU ${sku} (${i + 1}/${productSkus.length})`);
          created++;
        }
      }
    } catch (error) {
      console.error(`❌ Error processing statistics for SKU ${sku}:`, error.message);
      errors++;
    }
  }

  // Calculate and sync global statistics (all reviews combined)
  console.log('\n📊 Calculating global statistics (all reviews)...');
  const globalStats = calculateGlobalStatistics(reviews);

  try {
    const existingGlobal = await client.getStatisticsMetaobjectBySku('_global_all_reviews');
    const globalFields = transformStatisticsToMetaobject(globalStats);

    if (existingGlobal) {
      const result = await client.updateStatisticsMetaobject(
        existingGlobal.id,
        globalFields
      );

      if (result.userErrors && result.userErrors.length > 0) {
        console.error('❌ Error updating global statistics:', result.userErrors);
        errors++;
      } else {
        console.log(`✓ Updated global stats: ${globalStats.totalReviews} total reviews, ${globalStats.averageRating}⭐ average`);
        updated++;
      }
    } else {
      const result = await client.createStatisticsMetaobject(globalFields);

      if (result.userErrors && result.userErrors.length > 0) {
        console.error('❌ Error creating global statistics:', result.userErrors);
        errors++;
      } else {
        console.log(`✓ Created global stats: ${globalStats.totalReviews} total reviews, ${globalStats.averageRating}⭐ average`);
        created++;
      }
    }
  } catch (error) {
    console.error(`❌ Error processing global statistics:`, error.message);
    errors++;
  }

  console.log('\n' + '='.repeat(50));
  console.log('Statistics Sync Complete!');
  console.log('='.repeat(50));
  console.log(`✓ Created: ${created}`);
  console.log(`✓ Updated: ${updated}`);
  console.log(`✗ Errors: ${errors}`);
  console.log(`📊 Total: ${productSkus.length + 1} (${productSkus.length} products + 1 global)`);
  console.log('='.repeat(50));

  return { created, updated, errors };
}

// Allow running as standalone script
if (import.meta.url === `file://${process.argv[1]}`) {
  syncReviewStatistics()
    .then(() => {
      console.log('\n✓ Statistics sync completed successfully!');
      process.exit(0);
    })
    .catch(error => {
      console.error('\n❌ Statistics sync failed:', error.message);
      console.error(error.stack);
      process.exit(1);
    });
}
