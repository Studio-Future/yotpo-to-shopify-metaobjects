import 'dotenv/config';
import { ShopifyClient } from './clients/shopify-client.js';

async function setupStatisticsMetaobjectDefinition() {
  console.log('Setting up Yotpo Review Statistics metaobject definition in Shopify...\n');

  const shopifyClient = new ShopifyClient(
    process.env.SHOPIFY_SHOP_URL,
    process.env.SHOPIFY_ACCESS_TOKEN,
    process.env.SHOPIFY_API_VERSION
  );

  try {
    const result = await shopifyClient.createStatisticsMetaobjectDefinition();

    if (result.userErrors && result.userErrors.length > 0) {
      console.error('Errors creating statistics metaobject definition:');
      result.userErrors.forEach(error => {
        console.error(`- ${error.message} (${error.code})`);
      });
      process.exit(1);
    }

    console.log('✓ Statistics metaobject definition created successfully!');
    console.log(`\nDefinition ID: ${result.metaobjectDefinition.id}`);
    console.log(`Type: ${result.metaobjectDefinition.type}`);
    console.log(`Name: ${result.metaobjectDefinition.name}`);
    console.log(`\nFields created:`);

    result.metaobjectDefinition.fieldDefinitions.forEach(field => {
      console.log(`  - ${field.name} (${field.key}): ${field.type.name}`);
    });

    console.log('\nYou can now run "npm run sync" to sync reviews and statistics from Yotpo!');
  } catch (error) {
    console.error('Error setting up statistics metaobject definition:', error.message);
    process.exit(1);
  }
}

setupStatisticsMetaobjectDefinition();
