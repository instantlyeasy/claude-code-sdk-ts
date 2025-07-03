import { claude } from './dist/index.js';

// Test the asMarkdown() method
async function testMarkdown() {
  console.log('Testing asMarkdown() method...\n');

  const prompt = `Create a comprehensive guide about Node.js best practices that includes:
  - A title and introduction
  - Multiple sections with headers
  - Code examples in JavaScript
  - A bulleted list of tips
  - A numbered list of steps
  - Some **bold** and *italic* text
  - A table comparing different approaches`;

  try {
    const article = await claude()
      .withModel('opus')
      .skipPermissions()
      .withTimeout(90000)
      .query(prompt)
      .asMarkdown();

    console.log('Generated Markdown:\n');
    console.log('=' .repeat(80));
    console.log(article);
    console.log('=' .repeat(80));
    console.log('\nMarkdown generation successful!');
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testMarkdown().catch(console.error);