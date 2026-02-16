import { describe, it, expect } from 'vitest';
import { listDetector } from '../../src/detectors/list';

describe('List Detector', () => {
  it('should detect an ordered list with step-like content', () => {
    const md = `How to set up:

1. Install the dependencies with npm
2. Create a configuration file
3. Run the development server`;

    const matches = listDetector.detect(md);
    expect(matches.length).toBe(1);
    expect(matches[0].data.items.length).toBe(3);
    expect(matches[0].data.hasStepPattern).toBe(true);
  });

  it('should not detect lists with fewer than 3 items', () => {
    const md = `1. First item is quite long and detailed
2. Second item is also long and detailed`;

    const matches = listDetector.detect(md);
    expect(matches.length).toBe(0);
  });

  it('should not detect lists with very short items', () => {
    const md = `1. Apples
2. Oranges
3. Bananas`;

    const matches = listDetector.detect(md);
    expect(matches.length).toBe(0); // avg length < 15
  });

  it('should detect lists with detailed items', () => {
    const md = `1. Open your terminal and navigate to the project directory
2. Run the installation command to set up dependencies
3. Configure the database connection settings
4. Start the application server`;

    const matches = listDetector.detect(md);
    expect(matches.length).toBe(1);
    expect(matches[0].data.items.length).toBe(4);
  });

  it('should give higher confidence when step keywords are present', () => {
    const mdSteps = `1. First install Node.js from the official website
2. Then create a new project with npm init
3. Next configure your environment variables`;

    const mdPlain = `1. The system has a robust architecture design
2. The database supports multiple data formats
3. The interface provides various configuration options`;

    const stepsMatches = listDetector.detect(mdSteps);
    const plainMatches = listDetector.detect(mdPlain);

    expect(stepsMatches[0].confidence).toBeGreaterThan(plainMatches[0].confidence);
  });

  it('should transform to livellm:accordion', () => {
    const md = `1. Open the project directory in your terminal
2. Install the required dependencies with npm
3. Start the development server locally`;

    const matches = listDetector.detect(md);
    const result = listDetector.transform(matches[0]);

    expect(result).toContain('livellm:accordion');
    const json = JSON.parse(result.split('\n')[1]);
    expect(json.sections.length).toBe(3);
    expect(json.sections[0].title).toBe('Step 1');
    expect(json.mode).toBe('exclusive');
    expect(json.defaultOpen).toBe(0);
  });

  it('should handle lists with parenthesis style', () => {
    const md = `1) Navigate to the settings page in the dashboard
2) Click on the advanced configuration tab
3) Update the environment variable settings`;

    const matches = listDetector.detect(md);
    expect(matches.length).toBe(1);
    expect(matches[0].data.items.length).toBe(3);
  });

  it('should detect multiple lists in the same document', () => {
    const md = `## Setup

1. Install the Node.js runtime from official site
2. Clone the repository from GitHub
3. Run npm install in the project directory

## Deployment

1. Build the production bundle with npm run build
2. Configure the deployment environment variables
3. Deploy to the cloud hosting provider`;

    const matches = listDetector.detect(md);
    expect(matches.length).toBe(2);
  });
});
