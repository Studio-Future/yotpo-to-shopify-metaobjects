import 'dotenv/config';
import { ShopifyClient } from './clients/shopify-client.js';

async function setupStatisticsMetaobjectDefinition() {
  console.log('Setting up Yotpo Review Statistics metaobject definition in Shopify...\n');

  const shopifyClient = new ShopifyClient(
    process.env.SHOPIFY_SHOP_URL,
    process.env.SHOPIFY_ACCESS_TOKEN,
    process.env.SHOPIFY_API_VERSION || '2025-07'
  );

  try {
    const mutation = `
      mutation CreateStatisticsDefinition($definition: MetaobjectDefinitionCreateInput!) {
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

    const variables = {
      definition: {
        name: 'Yotpo Review Statistics',
        type: 'yotpo_review_statistics',
        description: 'Aggregated review statistics per product, synced from Yotpo',
        capabilities: {
          publishable: {
            enabled: true
          }
        },
        fieldDefinitions: [
          {
            key: 'product_sku',
            name: 'Product SKU',
            type: 'single_line_text_field',
            description: 'Product SKU for matching',
            required: true,
          },
          {
            key: 'product_reference',
            name: 'Product Reference',
            type: 'product_reference',
            description: 'Linked Shopify product',
          },
          {
            key: 'average_rating',
            name: 'Average Rating',
            type: 'number_decimal',
            description: 'Average star rating (1-5)',
            validations: [
              { name: 'min', value: '0' },
              { name: 'max', value: '5' },
            ],
          },
          {
            key: 'total_reviews',
            name: 'Total Reviews',
            type: 'number_integer',
            description: 'Total number of reviews',
          },
          {
            key: 'five_star_count',
            name: '5-Star Count',
            type: 'number_integer',
            description: 'Number of 5-star reviews',
          },
          {
            key: 'four_star_count',
            name: '4-Star Count',
            type: 'number_integer',
            description: 'Number of 4-star reviews',
          },
          {
            key: 'three_star_count',
            name: '3-Star Count',
            type: 'number_integer',
            description: 'Number of 3-star reviews',
          },
          {
            key: 'two_star_count',
            name: '2-Star Count',
            type: 'number_integer',
            description: 'Number of 2-star reviews',
          },
          {
            key: 'one_star_count',
            name: '1-Star Count',
            type: 'number_integer',
            description: 'Number of 1-star reviews',
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

    const result = await shopifyClient.graphqlRequest(mutation, variables);

    if (result.metaobjectDefinitionCreate.userErrors && result.metaobjectDefinitionCreate.userErrors.length > 0) {
      console.error('Errors creating statistics metaobject definition:');
      result.metaobjectDefinitionCreate.userErrors.forEach(error => {
        console.error(`- ${error.message} (${error.code})`);
      });
      process.exit(1);
    }

    const definition = result.metaobjectDefinitionCreate.metaobjectDefinition;
    console.log('✓ Statistics metaobject definition created successfully!');
    console.log(`\nDefinition ID: ${definition.id}`);
    console.log(`Type: ${definition.type}`);
    console.log(`Name: ${definition.name}`);
    console.log(`\nFields created:`);

    definition.fieldDefinitions.forEach(field => {
      console.log(`  - ${field.name} (${field.key}): ${field.type.name}`);
    });

    console.log('\nYou can now run "npm run sync" to sync reviews and statistics from Yotpo!');
  } catch (error) {
    console.error('Error setting up statistics metaobject definition:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
    process.exit(1);
  }
}

setupStatisticsMetaobjectDefinition();
