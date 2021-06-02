const axios = require('axios');

const githubURL = (owner, repo) => `https://api.github.com/repos/${owner}/${repo}`;

class GithubClient {
  constructor(owner, repo, required = false) {
    const username = process.env.GITHUB_USERNAME;
    const token = process.env.GITHUB_ACCESS_TOKEN;

    const clientConfig = {
      baseURL: githubURL(owner, repo),
      timeout: 10000,
    };

    if (required && !username && !token) {
      throw new Error('operation needs a GITHUB_USERNAME and GITHUB_ACCESS_TOKEN environment variables');
    }

    if (username && token) {
      clientConfig.auth = { username: username, password: token };
    }

    this.client = this.createClient(clientConfig);
  }

  createClient(clientConfig) {
    return axios.create(clientConfig);
  }
}

module.exports = GithubClient;
