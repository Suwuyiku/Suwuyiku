export default {
    async fetch(request, env) {
        // 1. CORS Headers (Crucial for allowing your website to talk to the API)
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        };

        // Handle preflight requests from the browser
        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        const url = new URL(request.url);

        // ---------------------------------------------------------
        // ROUTE A: The Spark Counter
        // ---------------------------------------------------------
        if (url.pathname === "/sparks") {
            let sparks = await env.SPARKS_KV.get("total_sparks");
            sparks = sparks ? parseInt(sparks) : 0;

            if (request.method === "POST") {
                sparks += 1;
                await env.SPARKS_KV.put("total_sparks", sparks.toString());
            }

            return new Response(JSON.stringify({ sparks }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // ---------------------------------------------------------
        // ROUTE B: Fetch Notion Posts
        // ---------------------------------------------------------
        if (url.pathname === "/posts") {
            try {
                const notionResponse = await fetch(`https://api.notion.com/v1/databases/${env.NOTION_DATABASE_ID}/query`, {
                    method: "POST",
                    headers: {
                        "Authorization": `Bearer ${env.NOTION_KEY}`,
                        "Notion-Version": "2022-06-28",
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        filter: {
                            property: "Status",
                            select: { equals: "Published" }
                        },
                        sorts: [
                            { property: "Date", direction: "descending" }
                        ]
                    })
                });

                const data = await notionResponse.json();

                return new Response(JSON.stringify(data), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });

            } catch (error) {
                return new Response(JSON.stringify({ error: "Failed to fetch Notion data" }), { 
                    status: 500, 
                    headers: { ...corsHeaders, "Content-Type": "application/json" } 
                });
            }
        }

        // Default Fallback
        return new Response("Suwuyiku Fragments API is live!", { headers: corsHeaders });
    }
};
