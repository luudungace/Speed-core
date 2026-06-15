import type { SerperResult } from "@/lib/types/crawler";
import { isUrlExcluded } from "@/lib/utils/crawler-filters";

const SERPER_ENDPOINT = "https://google.serper.dev/search";

function isAllowedUrl(url: string, excludeDomains: string[] = []) {
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return false;
    return !isUrlExcluded(url, excludeDomains);
  } catch {
    return false;
  }
}

export class SerperDorkScraper {
  private apiKey = process.env.SERPER_API_KEY;

  async searchDorkDeep(
    query: string,
    maxResults: number,
    excludeDomains: string[] = []
  ): Promise<SerperResult[]> {
    if (!this.apiKey) throw new Error("Missing SERPER_API_KEY.");

    const results: SerperResult[] = [];
    let numPerPage = 100; // Max results per request for cost efficiency
    let totalPages = Math.ceil(maxResults / numPerPage);

    console.log(`Deep searching query: "${query}" | maxResults: ${maxResults} | pages: ${totalPages}`);

    for (let page = 1; page <= totalPages; page += 1) {
      console.log(`Calling Serper API for page ${page} with num = ${numPerPage}...`);
      
      let response = await fetch(SERPER_ENDPOINT, {
        method: "POST",
        headers: {
          "X-API-KEY": this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: query,
          page,
          num: numPerPage,
        }),
      });

      if (response.status === 400 && numPerPage === 100) {
        const errText = await response.clone().text();
        if (errText.includes("free accounts") || errText.includes("Query pattern not allowed")) {
          console.log("⚠️ Detect free account Serper limit for advanced footprints. Falling back to num = 10 per page.");
          numPerPage = 10;
          totalPages = Math.ceil(maxResults / numPerPage);
          
          // Retry the current page query with num: 10
          response = await fetch(SERPER_ENDPOINT, {
            method: "POST",
            headers: {
              "X-API-KEY": this.apiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              q: query,
              page,
              num: numPerPage,
            }),
          });
        }
      }

      if (!response.ok) {
        throw new Error(`Serper API error ${response.status}: ${await response.text()}`);
      }

      const payload = (await response.json()) as { organic?: Array<{ title?: string; link?: string; snippet?: string; position?: number }> };
      const organic = payload.organic ?? [];

      console.log(`Received ${organic.length} results from Serper page ${page}.`);

      if (organic.length === 0) {
        // No more results available on Google
        console.log("No more organic results found. Breaking pagination early.");
        break;
      }

      for (const item of organic) {
        if (!item.link || !isAllowedUrl(item.link, excludeDomains)) continue;
        results.push({
          url: item.link,
          title: item.title,
          snippet: item.snippet,
          position: item.position,
          raw: { ...item, dork: query, page },
        });
      }

      if (organic.length < numPerPage) {
        // Returned less than requested, meaning we reached the end of Google's SERP
        console.log("Reached end of Google search results. Breaking pagination early.");
        break;
      }
    }

    return results;
  }
}
