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

        // =================================================--------
        // ROUTE 1: Smart IP-Based Spark Engine
        // =================================================--------
        if (url.pathname === "/sparks") {
            // Get user's IP Address directly from Cloudflare network
            const clientIP = request.headers.get("cf-connecting-ip") || "anonymous_user";
            const ipKey = `spark_ip_${clientIP}`;

            // Read total sparks and check if THIS specific IP address has sparked
            let sparks = await env.SPARKS_KV.get("total_sparks");
            sparks = sparks ? parseInt(sparks) : 0;

            const userHasSparked = (await env.SPARKS_KV.get(ipKey)) === "true";

            // GET Request: Return total sparks AND whether THIS user's IP address has sparked
            if (request.method === "GET") {
                return new Response(JSON.stringify({ sparks, hasSparked: userHasSparked }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            // POST Request: Toggle Spark state server-side
            if (request.method === "POST") {
                let newSparkState = false;

                if (userHasSparked) {
                    // User already sparked -> REMOVE SPARK
                    sparks = Math.max(0, sparks - 1);
                    await env.SPARKS_KV.delete(ipKey); // Remove IP record
                    newSparkState = false;
                } else {
                    // User hasn't sparked -> ADD SPARK
                    sparks += 1;
                    await env.SPARKS_KV.put(ipKey, "true"); // Save IP record
                    newSparkState = true;
                }

                await env.SPARKS_KV.put("total_sparks", sparks.toString());

                return new Response(JSON.stringify({ sparks, hasSparked: newSparkState }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }
        }

        // =================================================--------
        // ROUTE 2: Fetch Notion Database
        // =================================================--------
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

        // =================================================--------
        // ROUTE 3: Fetch Page Content Blocks
        // =================================================--------
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
