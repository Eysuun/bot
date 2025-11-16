require("dotenv").config({ path: "e.env" });
const axios = require("axios");

// Konfiguracja
const API_500_KEY = process.env.API_500_KEY;
const API_500 = "https://api.500.casino/trading/market";
const CSFLOAT_URL = process.env.CSFLOAT_URL;
const BUX_RATE = parseFloat(process.env.BUX_RATE || "0.0006");

// Pobranie ofert z 500Casino
async function fetch500() {
  try {
    const res = await axios.get(API_500, {
      headers: {
        "Authorization": `Bearer ${API_500_KEY}`,
        "Content-Type": "application/json"
      }
    });
    return res.data.listings.map(item => ({
      name: item.item.marketHashName,
      price_usd: item.price * BUX_RATE
    }));
  } catch (err) {
    console.error("Error fetching 500Casino:", err.response?.status, err.message);
    return [];
  }
}

// Pobranie ofert z CSFloat z retry na 429
async function fetchCSFloat(retries = 3, delayMs = 2000) {
  try {
    const res = await axios.get(CSFLOAT_URL);
    return res.data.listings.map(item => ({
      name: item.item.market_hash_name,
      price_usd: item.price
    }));
  } catch (err) {
    if (err.response?.status === 429 && retries > 0) {
      console.warn(`CSFloat 429 - retrying in ${delayMs}ms...`);
      await new Promise(r => setTimeout(r, delayMs));
      return fetchCSFloat(retries - 1, delayMs * 2);
    }
    console.error("Error fetching CSFloat:", err.response?.status || err.message);
    return [];
  }
}

// Porównanie cen i wyliczenie zniżki
function compare(offers500, offersFloat) {
  const floatMap = new Map();
  for (const f of offersFloat) floatMap.set(f.name, f.price_usd);

  const deals = [];
  for (const item of offers500) {
    if (!floatMap.has(item.name)) continue;
    const price500 = item.price_usd;
    const priceFloat = floatMap.get(item.name);
    if (price500 < priceFloat) {
      const discount = ((priceFloat - price500) / priceFloat) * 100;
      deals.push({
        name: item.name,
        price_500: price500.toFixed(2),
        price_float: priceFloat.toFixed(2),
        discount: discount.toFixed(2) + "%"
      });
    }
  }
  deals.sort((a, b) => parseFloat(b.discount) - parseFloat(a.discount));
  return deals;
}

// Uruchomienie bota
async function main() {
  console.log("Fetching 500Casino offers...");
  const offers500 = await fetch500();

  console.log("Fetching CSFloat offers...");
  const offersFloat = await fetchCSFloat();

  console.log("Comparing prices...");
  const deals = compare(offers500, offersFloat);

  if (deals.length === 0) {
    console.log("No deals found.");
  } else {
    console.table(deals.slice(0, 20));
  }
}

main();
