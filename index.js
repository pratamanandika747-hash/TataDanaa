// api/index.js - Vercel Serverless Function entry point for TataDana
const handleRequest = require('../server/app_runner.cjs');

module.exports = async (req, res) => {
  return handleRequest(req, res);
};
