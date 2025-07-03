import { claude } from '../dist/index.js';

// Example: Generate content formatted as markdown
async function generateMarkdownArticle() {
  const prompt = `Write a short article about JavaScript async/await with:
  - A title
  - An introduction
  - Code examples
  - Best practices section`;

  const article = await claude()
    .withModel('opus')
    .skipPermissions()
    .withTimeout(90000)
    .query(prompt)
    .asMarkdown();

  console.log(article);
}

// Run the example
generateMarkdownArticle().catch(console.error);