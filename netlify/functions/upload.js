import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  try {
    const body = JSON.parse(event.body);
    const { username, lat, long, date_taken } = body;

    // Insert raw string blobs into Supabase for now
    const { data, error } = await supabase
      .from("user_photos")
      .insert([{ username, lat, long, date_taken }]);

    if (error) throw error;

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, message: "Received!", data })
    };
  } catch (err) {
    console.error("Upload error:", err.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: err.message })
    };
  }
}
