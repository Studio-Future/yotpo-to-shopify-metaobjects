import fetch from 'node-fetch';

export class YotpoClient {
  constructor(appKey, appSecretOrUserToken = null, isUserToken = false) {
    this.appKey = appKey;
    this.baseUrl = 'https://api.yotpo.com';

    // If isUserToken is explicitly true, or if the value looks like it should be treated as a token
    if (isUserToken || (appSecretOrUserToken !== null && appSecretOrUserToken.length >= 40)) {
      // Use as user token directly
      this.appSecret = null;
      this.token = appSecretOrUserToken;
    } else {
      // Use as app secret (requires authentication)
      this.appSecret = appSecretOrUserToken;
      this.token = null;
    }
  }

  async authenticate() {
    // If we already have a token provided, skip authentication
    if (this.token) {
      return this.token;
    }

    if (!this.appSecret) {
      throw new Error('Cannot authenticate: no app secret or user token provided');
    }

    const response = await fetch(`${this.baseUrl}/oauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: this.appKey,
        client_secret: this.appSecret,
        grant_type: 'client_credentials',
      }),
    });

    if (!response.ok) {
      throw new Error(`Yotpo authentication failed: ${response.statusText}`);
    }

    const data = await response.json();
    this.token = data.access_token;
    return this.token;
  }

  async getAllReviews(page = 1, perPage = 100) {
    if (!this.token) {
      await this.authenticate();
    }

    const response = await fetch(
      `${this.baseUrl}/v1/apps/${this.appKey}/reviews?utoken=${this.token}&page=${page}&count=${perPage}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.status === 401) {
      // Token expired, re-authenticate and retry
      await this.authenticate();
      return this.getAllReviews(page, perPage);
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch reviews: ${response.statusText}`);
    }

    const data = await response.json();
    return data;
  }

  async fetchAllReviewsPaginated() {
    const allReviews = [];
    let page = 1;
    let hasMore = true;

    console.log('Fetching all reviews from Yotpo...');

    while (hasMore) {
      const data = await this.getAllReviews(page, 100);

      // The API returns reviews directly in data.reviews (not data.response.reviews)
      if (data.reviews && Array.isArray(data.reviews)) {
        allReviews.push(...data.reviews);
        console.log(`Fetched page ${page}: ${data.reviews.length} reviews`);

        // Check if there are more pages
        // Note: This endpoint doesn't return pagination info, so we check if we got a full page
        hasMore = data.reviews.length === 100;
        page++;
      } else {
        hasMore = false;
      }
    }

    console.log(`Total reviews fetched: ${allReviews.length}`);
    return allReviews;
  }
}
