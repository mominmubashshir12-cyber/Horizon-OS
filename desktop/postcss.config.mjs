// PostCSS configuration — integrates Tailwind CSS v4 via the @tailwindcss/postcss plugin
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
};

export default config;
