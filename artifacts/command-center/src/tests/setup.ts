import '@testing-library/jest-dom';

// Silence React 19 act() warnings that appear during async Suspense tests.
const originalError = console.error.bind(console);
beforeAll(() => {
  console.error = (...args: unknown[]) => {
    const msg = typeof args[0] === 'string' ? args[0] : '';
    if (
      msg.includes('Warning: An update to') ||
      msg.includes('act(') ||
      msg.includes('ReactDOM.render')
    ) {
      return;
    }
    originalError(...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
