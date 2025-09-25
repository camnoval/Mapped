import { getStore } from "@netlify/blobs";

export async function handler(event) {
  const store = getStore("photo-data"); // creates a blob store named "photo-data"

  if (event.httpMethod === "POST") {
    try {
      const data = JSON.parse(event.body);

      // Store new entry with timestamp as key
      const key = `entry-${Date.now()}`;
      await store.setJSON(key, data);

      return {
        statusCode: 200,
        body: JSON.stringify({ message: "Saved successfully", id: key }),
      };
    } catch (err) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Invalid JSON", details: err.message }),
      };
    }
  }

  if (event.httpMethod === "GET") {
    try {
      const list = await store.list();
      const all = [];
      for (const item of list.blobs) {
        const value = await store.get(item.key, { type: "json" });
        all.push(value);
      }

      return {
        statusCode: 200,
        body: JSON.stringify(all),
      };
    } catch (err) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to fetch data" }),
      };
    }
  }

  return {
    statusCode: 405,
    body: JSON.stringify({ error: "Method Not Allowed" }),
  };
}
