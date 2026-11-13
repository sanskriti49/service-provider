// Hermetic benchmark configuration: never read the application's .env secrets.
const path = require('node:path');
const { createRequire } = require('node:module');
const serverRequire = createRequire(path.resolve(__dirname, '../../server/package.json'));
serverRequire('dotenv').config = () => ({ parsed: {} });
Object.assign(process.env, {
  NODE_ENV: 'test', DATABASE_URL: 'postgresql://taskgenie_bench:local_bench_only@127.0.0.1:5544/taskgenie_bench',
  REDIS_URL: 'redis://127.0.0.1:6384', JWT_SECRET: 'taskgenie-local-k6-fixture-secret-only',
  PORT: process.env.BENCH_PORT || '3101', DB_POOL_MAX: '20', DB_POOL_MIN: '2',
  RAZORPAY_KEY_ID: '', RAZORPAY_KEY_SECRET: '', RAZORPAY_WEBHOOK_SECRET: '',
  EMAIL_USER: '', EMAIL_PASS: '', PAYMENT_RECONCILIATION_ENABLED: 'false',
  AWS_ACCESS_KEY_ID: '', AWS_SECRET_ACCESS_KEY: '', CLOUDINARY_URL: '',
});
module.exports = { serverRequire };
