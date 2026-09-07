# Contributing to Anchor

Thank you for your interest in contributing to Anchor! This document provides guidelines and information for contributors.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Code Style](#code-style)
- [Testing](#testing)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)
- [Security](#security)

## Code of Conduct

### Our Pledge

We are committed to making participation in Anchor a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, sex characteristics, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

Examples of behavior that contributes to creating a positive environment include:

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

Examples of unacceptable behavior include:

- The use of sexualized language or imagery and unwelcome sexual attention or advances
- Trolling, insulting/derogatory comments, and personal or political attacks
- Public or private harassment
- Publishing others' private information, such as a physical or electronic address, without explicit permission
- Other conduct which could reasonably be considered inappropriate in a professional setting

## Getting Started

### Prerequisites

- Node.js 18+
- Python 3.11+
- Docker 24.0+
- Git 2.40+
- AWS CLI 2.15+ (for deployment)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/anchor.git
   cd anchor
   ```

3. Add upstream remote:
   ```bash
   git remote add upstream https://github.com/anchor/memory.git
   ```

## Development Setup

### 1. Install Dependencies

```bash
# Install root dependencies
npm install

# Install API dependencies
cd apps/api
npm install

# Install web dependencies
cd ../web
npm install

# Install mobile dependencies
cd ../mobile
npm install

# Install AI dependencies
cd ../ai
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
# Copy environment file
cp apps/api/.env.example apps/api/.env

# Update with your configuration
# See README.md for required variables
```

### 3. Start Development Servers

```bash
# Start all servers
make dev

# Or start individually
cd apps/api && npm run start:dev
cd apps/web && npm run dev
cd apps/ai && python main.py
cd apps/mobile && npm start
```

### 4. Run Tests

```bash
# Run all tests
make test

# Run API tests
cd apps/api && npm run test

# Run web tests
cd apps/web && npm run test

# Run AI tests
cd apps/ai && python -m pytest tests/
```

## Code Style

### TypeScript/JavaScript

- Use TypeScript for all new code
- Follow ESLint configuration
- Use Prettier for formatting
- Use meaningful variable names
- Add JSDoc comments for complex functions

```typescript
/**
 * Creates a new memory with AI-generated summary and embedding
 * @param userId - The user ID
 * @param content - The memory content
 * @returns The created memory
 */
async function createMemory(userId: string, content: string): Promise<Memory> {
  // Implementation
}
```

### Python

- Follow PEP 8 style guide
- Use type hints
- Add docstrings for all functions
- Use meaningful variable names

```python
def generate_embedding(text: str) -> list[float]:
    """
    Generate embedding vector for text content.
    
    Args:
        text: The text to generate embedding for
        
    Returns:
        List of floats representing the embedding
    """
    # Implementation
```

### Git Commit Messages

- Use conventional commits format
- Keep commit messages concise
- Reference issue numbers when applicable

```
feat: add memory search endpoint
fix: resolve calendar sync issue
docs: update API documentation
test: add unit tests for memory service
```

## Testing

### Unit Tests

- Write unit tests for all new functions
- Aim for 80%+ code coverage
- Use descriptive test names
- Test both success and error cases

```typescript
describe('MemoryService', () => {
  it('should create memory with AI summary', async () => {
    // Test implementation
  });

  it('should throw error when memory not found', async () => {
    // Test implementation
  });
});
```

### Integration Tests

- Test API endpoints end-to-end
- Test database operations
- Test external service integrations

### E2E Tests

- Test complete user flows
- Test critical paths
- Test error scenarios

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:cov

# Run specific test file
npm run test -- memory.service.spec.ts

# Run in watch mode
npm run test:watch
```

## Pull Request Process

### 1. Create Feature Branch

```bash
# Update main branch
git checkout main
git pull upstream main

# Create feature branch
git checkout -b feature/your-feature-name
```

### 2. Make Changes

- Write code following code style guidelines
- Add tests for new functionality
- Update documentation if needed
- Ensure all tests pass

### 3. Commit Changes

```bash
# Stage changes
git add .

# Commit with descriptive message
git commit -m "feat: add your feature description

- Add detailed description of changes
- Reference issue: #123

🤖 Generated with Codebuff
Co-Authored-By: Codebuff <noreply@codebuff.com>"
```

### 4. Push Changes

```bash
git push origin feature/your-feature-name
```

### 5. Create Pull Request

1. Go to GitHub repository
2. Click "New Pull Request"
3. Select your feature branch
4. Fill out PR template:
   - **Title**: Concise description of changes
   - **Description**: Detailed explanation of changes
   - **Testing**: How changes were tested
   - **Screenshots**: If applicable

### 6. Code Review

- Address review comments
- Make requested changes
- Request re-review when ready

### 7. Merge

- PR must be approved by at least one maintainer
- All checks must pass
- Squash and merge

## Issue Guidelines

### Bug Reports

When filing a bug report, please include:

1. **Environment**: OS, browser, Node.js version
2. **Steps to reproduce**: Clear steps to reproduce the issue
3. **Expected behavior**: What you expected to happen
4. **Actual behavior**: What actually happened
5. **Screenshots**: If applicable
6. **Additional context**: Any other relevant information

### Feature Requests

When requesting a feature, please include:

1. **Problem**: What problem does this feature solve?
2. **Solution**: How should this feature work?
3. **Alternatives**: Have you considered alternatives?
4. **Additional context**: Any other relevant information

### Good First Issues

Look for issues labeled `good first issue` if you're new to the project. These are specifically chosen to be approachable for newcomers.

## Security

### Reporting Security Issues

If you discover a security vulnerability, please report it responsibly:

1. **Email**: security@anchor.app
2. **Do not** open a public GitHub issue
3. **Do not** discuss the vulnerability publicly
4. **Include**: Detailed description and steps to reproduce

### Security Response

- We will acknowledge receipt within 24 hours
- We will provide a timeline for resolution
- We will credit reporters in security advisories

## License

By contributing to Anchor, you agree that your contributions will be licensed under the MIT License.

## Questions?

If you have questions about contributing, please:

1. Check existing documentation
2. Search existing issues
3. Open a new issue with the `question` label
4. Join our Discord community

## Thank You!

Thank you for contributing to Anchor! Your help makes this project better for everyone.

---

*Last updated: August 2026*
