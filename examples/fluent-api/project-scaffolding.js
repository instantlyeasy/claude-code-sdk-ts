import { claude } from '../../dist/index.js';
import path from 'path';

/**
 * Project Scaffolding Example using Fluent API
 * Demonstrates creating complete project structures with Claude Code SDK
 */

async function createProject(projectType, projectName) {
  console.log(`Creating ${projectType} project: ${projectName}\n`);
  
  // Configure the query builder for project creation
  const projectBuilder = claude()
    .withModel('opus')
    .allowTools('Write', 'LS', 'Bash')
    .acceptEdits()
    .withTimeout(120000)
    .inDirectory(path.resolve('.'))
    .onToolUse(tool => {
      console.log(`  [${tool.name}] ${tool.input?.path || tool.input?.command || ''}`);
    });
  
  // Define project templates
  const projectTemplates = {
    'react-app': `Create a modern React application with the following structure:
      - ${projectName}/
        - src/
          - components/
          - hooks/
          - utils/
          - App.jsx
          - index.js
        - public/
          - index.html
        - package.json (with React 18, webpack, babel)
        - .gitignore
        - README.md
      Include a simple counter component as an example.`,
    
    'node-api': `Create a Node.js REST API with the following structure:
      - ${projectName}/
        - src/
          - controllers/
          - models/
          - routes/
          - middleware/
          - app.js
        - tests/
        - package.json (with Express, Jest, nodemon)
        - .env.example
        - .gitignore
        - README.md
      Include a simple user CRUD API as an example.`,
    
    'typescript-lib': `Create a TypeScript library with the following structure:
      - ${projectName}/
        - src/
          - index.ts
          - types.ts
        - tests/
        - dist/
        - package.json (with TypeScript, Jest, build scripts)
        - tsconfig.json
        - .gitignore
        - README.md
      Include proper ESM/CJS dual package setup.`,
    
    'python-cli': `Create a Python CLI application with the following structure:
      - ${projectName}/
        - ${projectName.replace(/-/g, '_')}/
          - __init__.py
          - cli.py
          - core.py
        - tests/
        - setup.py
        - requirements.txt
        - README.md
        - .gitignore
      Include Click for CLI and proper packaging setup.`
  };
  
  const template = projectTemplates[projectType];
  if (!template) {
    console.error(`Unknown project type: ${projectType}`);
    console.log('Available types:', Object.keys(projectTemplates).join(', '));
    return;
  }
  
  // Create the project
  try {
    const result = await projectBuilder
      .query(template)
      .asText();
    
    console.log('\n✅ Project created successfully!');
    console.log(result);
    
    // Follow up with additional setup
    console.log('\n📦 Installing dependencies...');
    
    const setupResult = await claude()
      .allowTools('Bash', 'Read')
      .withTimeout(60000)
      .inDirectory(path.resolve(projectName))
      .query(`Initialize the project:
        1. If it's a Node.js project, run npm install
        2. If it's a Python project, create a virtual environment
        3. Initialize git repository
        4. Show the final project structure`)
      .asText();
    
    console.log(setupResult);
    
  } catch (error) {
    console.error('Error creating project:', error.message);
  }
}

// Advanced scaffolding with configuration
async function createConfiguredProject() {
  // withConfigFile() is async (it reads + validates the file), so it returns a
  // Promise<QueryBuilder>. Await it first, then chain the synchronous builder
  // methods onto the resolved builder.
  const builder = await claude()
    .withConfigFile('../config/json/mcpconfig.json');

  builder
    .withModel('opus')
    .allowTools('Write', 'Read', 'LS', 'Edit')
    .acceptEdits()
    .withTimeout(180000);

  const result = await builder
    .query(`Create a full-stack application with:
      - Frontend: React with TypeScript, Vite, Tailwind CSS
      - Backend: Node.js with Express, TypeScript
      - Database: PostgreSQL with Prisma ORM
      - Testing: Jest for backend, Vitest for frontend
      - Docker: Multi-stage Dockerfile and docker-compose.yml
      - CI/CD: GitHub Actions workflow
      
      Project name: fullstack-app
      
      Include:
      - Proper monorepo structure
      - Shared types between frontend and backend
      - Authentication setup
      - Example CRUD operations`)
    .asText();
  
  console.log(result);
}

// CLI interface
const projectType = process.argv[2];
const projectName = process.argv[3];

if (!projectType || !projectName) {
  console.log('Usage: node project-scaffolding.js <project-type> <project-name>');
  console.log('\nAvailable project types:');
  console.log('  - react-app     : Modern React application');
  console.log('  - node-api      : Node.js REST API');
  console.log('  - typescript-lib: TypeScript library');
  console.log('  - python-cli    : Python CLI application');
  console.log('  - fullstack     : Full-stack application (special)');
  process.exit(1);
}

if (projectType === 'fullstack') {
  createConfiguredProject();
} else {
  createProject(projectType, projectName);
}