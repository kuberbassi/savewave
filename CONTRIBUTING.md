# Contributing to Savewave

Thank you for your interest in contributing to Savewave! We welcome bug reports, feature suggestions, and pull requests.

## Development Setup

1. **Fork & Clone**:
   ```bash
   git clone https://github.com/kuberbassi/savewave.git
   cd savewave
   ```

2. **Install Dependencies**:
   ```bash
   npm install
   ```

3. **Run Local Server**:
   ```bash
   npm start
   ```

4. **Run Test Suite**:
   ```bash
   npm test
   ```

## Pull Request Guidelines

- Ensure all automated unit and integration tests pass cleanly (`npm test`).
- Follow the existing stateless architectural principles (zero database, local history, stateless media resolution).
- Keep changes well-documented and submit clear PR descriptions.
