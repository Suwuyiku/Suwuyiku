export default {
    async fetch(request, env) {
        const corsHeaders = {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        };

        if (request.method === "OPTIONS") {
            return new Response(null, { headers: corsHeaders });
        }

        const url = new URL(request.url);

        // ROUTE 1: The Spark Counter (Now supports Adding AND Removing)
        if (url.pathname === "/sparks") {
            let sparks = await env.SPARKS_KV.get("total_sparks");
            sparks = sparks ? parseInt(sparks) : 0;

            if (request.method === "POST") {
                // Read what the website is asking us to do
                const body = await request.json().catch(() => ({}));
                
                if (body.action === "remove" && sparks > 0) {
                    sparks -= 1; // Remove a spark
                } else if (body.action === "add") {
                    sparks += 1; // Add a spark
                }
                
                await env.SPARKS_KV.put("total_sparks", sparks.toString());
            }

            return new Response(JSON.stringify({ sparks }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            });
        }

        // ROUTE 2: Fetch Notion Database
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
                        filter: { property: "Status", status: { equals: "Published" } },
                        sorts: [{ property: "Date", direction: "descending" }]
                    })
                });
                const data = await notionResponse.json();
                return new Response(JSON.stringify(data), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: "Failed to fetch Notion data" }), { status: 500, headers: corsHeaders });
            }
        }

        // ROUTE 3: Fetch Actual Page Content
        if (url.pathname === "/content") {
            const pageId = url.searchParams.get("id");
            if (!pageId) return new Response("Missing ID", { status: 400, headers: corsHeaders });

            try {
                const notionResponse = await fetch(`https://api.notion.com/v1/blocks/${pageId}/children`, {
                    method: "GET",
                    headers: {
                        "Authorization": `Bearer ${env.NOTION_KEY}`,
                        "Notion-Version": "2022-06-28"
                    }
                });
                const data = await notionResponse.json();
                return new Response(JSON.stringify(data), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            } catch (error) {
                return new Response(JSON.stringify({ error: "Failed to fetch content" }), { status: 500, headers: corsHeaders });
            }
        }

        return new Response("Suwuyiku API Live", { headers: corsHeaders });
    }
};
