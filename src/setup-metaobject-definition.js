import 'dotenv/config';
import { ShopifyClient } from './clients/shopify-client.js';

async function setupMetaobjectDefinitions() {
  console.log('Setting up optimized review metaobject definitions in Shopify...\n');

  const shopifyClient = new ShopifyClient(
    process.env.SHOPIFY_SHOP_URL,
    process.env.SHOPIFY_ACCESS_TOKEN,
    process.env.SHOPIFY_API_VERSION || '2025-07'
  );

  try {
    // Definition 1: Product Reviews
    console.log('1. Creating Product Review metaobject definition...\n');

    const productReviewMutation = `
      mutation CreateProductReviewDefinition($definition: MetaobjectDefinitionCreateInput!) {
        metaobjectDefinitionCreate(definition: $definition) {
          metaobjectDefinition {
            id
            name
            type
            fieldDefinitions {
              name
              key
              type {
                name
              }
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

    const productReviewVariables = {
      definition: {
        name: 'Yotpo Product Review',
        type: 'yotpo_product_review',
        description: 'Customer reviews for specific products, synced from Yotpo',
        capabilities: {
          publishable: {
            enabled: true
          }
        },
        fieldDefinitions: [
          // Core Fields
          {
            key: 'yotpo_id',
            name: 'Yotpo ID',
            type: 'single_line_text_field',
            description: 'Unique identifier from Yotpo (for sync)',
            required: true,
          },
          {
            key: 'rating',
            name: 'Rating',
            type: 'number_integer',
            description: 'Star rating (1-5)',
            required: true,
            validations: [
              { name: 'min', value: '1' },
              { name: 'max', value: '5' },
            ],
          },
          {
            key: 'title',
            name: 'Review Title',
            type: 'single_line_text_field',
            description: 'Review headline',
            required: true,
          },
          {
            key: 'content',
            name: 'Review Content',
            type: 'multi_line_text_field',
            description: 'Full review text',
            required: true,
          },

          // Reviewer Fields
          {
            key: 'reviewer_name',
            name: 'Reviewer Name',
            type: 'single_line_text_field',
            description: 'Customer name',
          },
          {
            key: 'reviewer_email',
            name: 'Reviewer Email',
            type: 'single_line_text_field',
            description: 'Customer email (admin only)',
          },

          // Product Association
          {
            key: 'product_sku',
            name: 'Product SKU',
            type: 'single_line_text_field',
            description: 'Yotpo SKU for matching',
            required: true,
          },
          {
            key: 'product_reference',
            name: 'Product Reference',
            type: 'product_reference',
            description: 'Linked Shopify product',
          },

          // Metadata
          {
            key: 'created_date',
            name: 'Created Date',
            type: 'date',
            description: 'When the review was written',
          },
          {
            key: 'sentiment_score',
            name: 'Sentiment Score',
            type: 'number_decimal',
            description: 'AI sentiment analysis (0-1)',
            validations: [
              { name: 'min', value: '0' },
              { name: 'max', value: '1' },
            ],
          },
          {
            key: 'helpful_votes',
            name: 'Helpful Votes',
            type: 'number_integer',
            description: 'Number of upvotes',
          },

          // Status
          {
            key: 'is_active',
            name: 'Is Active',
            type: 'boolean',
            description: 'Review is active (not deleted/archived)',
          },
          {
            key: 'synced_at',
            name: 'Synced At',
            type: 'date_time',
            description: 'Last sync timestamp',
          },
        ],
      },
    };

    const productReviewResult = await shopifyClient.graphqlRequest(
      productReviewMutation,
      productReviewVariables
    );

    if (productReviewResult.metaobjectDefinitionCreate.userErrors.length > 0) {
      console.error('❌ Errors creating product review definition:');
      productReviewResult.metaobjectDefinitionCreate.userErrors.forEach(error => {
        console.error(`  - ${error.message} (${error.code})`);
      });
    } else {
      const def = productReviewResult.metaobjectDefinitionCreate.metaobjectDefinition;
      console.log('✓ Product Review definition created successfully!');
      console.log(`  ID: ${def.id}`);
      console.log(`  Type: ${def.type}`);
      console.log(`  Fields: ${def.fieldDefinitions.length}`);
    }

    console.log('\n' + '='.repeat(60) + '\n');

    // Definition 2: Brand Reviews (site-level)
    console.log('2. Creating Brand Review metaobject definition...\n');

    const brandReviewMutation = `
      mutation CreateBrandReviewDefinition($definition: MetaobjectDefinitionCreateInput!) {
        metaobjectDefinitionCreate(definition: $definition) {
          metaobjectDefinition {
            id
            name
            type
            fieldDefinitions {
              name
              key
              type {
                name
              }
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

    const brandReviewVariables = {
      definition: {
        name: 'Yotpo Brand Review',
        type: 'yotpo_brand_review',
        description: 'General brand/site reviews not tied to specific products, synced from Yotpo',
        capabilities: {
          publishable: {
            enabled: true
          }
        },
        fieldDefinitions: [
          // Core Fields
          {
            key: 'yotpo_id',
            name: 'Yotpo ID',
            type: 'single_line_text_field',
            description: 'Unique identifier from Yotpo (for sync)',
            required: true,
          },
          {
            key: 'rating',
            name: 'Rating',
            type: 'number_integer',
            description: 'Star rating (1-5)',
            required: true,
            validations: [
              { name: 'min', value: '1' },
              { name: 'max', value: '5' },
            ],
          },
          {
            key: 'title',
            name: 'Review Title',
            type: 'single_line_text_field',
            description: 'Review headline',
            required: true,
          },
          {
            key: 'content',
            name: 'Review Content',
            type: 'multi_line_text_field',
            description: 'Full review text',
            required: true,
          },

          // Reviewer Fields
          {
            key: 'reviewer_name',
            name: 'Reviewer Name',
            type: 'single_line_text_field',
            description: 'Customer name',
          },
          {
            key: 'reviewer_email',
            name: 'Reviewer Email',
            type: 'single_line_text_field',
            description: 'Customer email (admin only)',
          },

          // Metadata
          {
            key: 'created_date',
            name: 'Created Date',
            type: 'date',
            description: 'When the review was written',
          },
          {
            key: 'sentiment_score',
            name: 'Sentiment Score',
            type: 'number_decimal',
            description: 'AI sentiment analysis (0-1)',
            validations: [
              { name: 'min', value: '0' },
              { name: 'max', value: '1' },
            ],
          },
          {
            key: 'helpful_votes',
            name: 'Helpful Votes',
            type: 'number_integer',
            description: 'Number of upvotes',
          },

          // Status
          {
            key: 'is_active',
            name: 'Is Active',
            type: 'boolean',
            description: 'Review is active (not deleted/archived)',
          },
          {
            key: 'synced_at',
            name: 'Synced At',
            type: 'date_time',
            description: 'Last sync timestamp',
          },
        ],
      },
    };

    const brandReviewResult = await shopifyClient.graphqlRequest(
      brandReviewMutation,
      brandReviewVariables
    );

    if (brandReviewResult.metaobjectDefinitionCreate.userErrors.length > 0) {
      console.error('❌ Errors creating brand review definition:');
      brandReviewResult.metaobjectDefinitionCreate.userErrors.forEach(error => {
        console.error(`  - ${error.message} (${error.code})`);
      });
    } else {
      const def = brandReviewResult.metaobjectDefinitionCreate.metaobjectDefinition;
      console.log('✓ Brand Review definition created successfully!');
      console.log(`  ID: ${def.id}`);
      console.log(`  Type: ${def.type}`);
      console.log(`  Fields: ${def.fieldDefinitions.length}`);
    }

    console.log('\n' + '='.repeat(60));
    console.log('\nSetup Complete!');
    console.log('='.repeat(60));
    console.log('\nMetaobject definitions created:');
    console.log('  1. yotpo_product_review - For product-specific reviews');
    console.log('  2. yotpo_brand_review - For site/brand-level reviews');
    console.log('\nYou can now run "npm run sync" to sync reviews from Yotpo!');
    console.log('='.repeat(60) + '\n');

  } catch (error) {
    console.error('\n❌ Error setting up metaobject definitions:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

setupMetaobjectDefinitions();
