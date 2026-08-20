// =================================================--------
// CRYPTOGRAPHIC HASHING ENGINE (GDPR Compliant IP Tracking)
// =================================================--------
async function generateUserHash(request) {
    const rawIP = request.headers.get("cf-connecting-ip") || "anonymous_user";
    // Adds a secret salt so the IP cannot be reverse-engineered
    const data = new TextEncoder().encode(rawIP + "_suwuyiku_secure_salt_2026");
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
    async fetch(request, env) {
        // =================================================--------
        // CORS CONFIGURATION (Permissive for local testing)
        // =================================================--------
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
        // ROUTE 1: THE SPARK ENGINE (Powered by Cloudflare KV)
        // =================================================--------
        if (url.pathname === "/sparks") {
            
            // 1. Generate the anonymous shadow hash for the user
            const userHash = await generateUserHash(request);

            if (request.method === "GET") {
                const pageId = url.searchParams.get("id");
                if (!pageId) return new Response("Missing ID", { status: 400, headers: corsHeaders });

                // 2. Locate the specific buckets in the KV Database
                const userKey = `spark_usr_${userHash}_${pageId}`;
                const countKey = `sparks_count_${pageId}`;

                let sparks = await env.SPARKS_KV.get(countKey);
                sparks = sparks ? parseInt(sparks) : 0;
                const userHasSparked = (await env.SPARKS_KV.get(userKey)) === "true";

                return new Response(JSON.stringify({ sparks, hasSparked: userHasSparked }), {
                    headers: { ...corsHeaders, "Content-Type": "application/json" }
                });
            }

            if (request.method === "POST") {
                const body = await request.json().catch(() => ({}));
                const pageId = body.id;
                if (!pageId) return new Response("Missing ID", { status: 400, headers: corsHeaders });

                const userKey = `spark_usr_${userHash}_${pageId}`;
                const countKey = `sparks_count_${pageId}`;

                let sparks = await env.SPARKS_KV.get(countKey);
                sparks = sparks ? parseInt(sparks) : 0;
                const userHasSparked = (await env.SPARKS_KV.get(userKey)) === "true";

                let newSparkState = userHasSparked;

                // 3. The Toggle Physics (Add or Remove)
                if (body.action === "add" && !userHasSparked) {
                    sparks += 1;
                    await env.SPARKS_KV.put(userKey, "true"); // Save the shadow hash to KV
                    newSparkState = true;
                } else if (body.action === "remove" && userHasSparked) {
                    sparks = Math.max(0, sparks - 1); // Prevents negative numbers
                    await env.SPARKS_KV.delete(userKey); // Wipes the shadow hash from KV
                    newSparkState = false;
                }

                await env.SPARKS_KV.put(countKey, sparks.toString()); // Update total score

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
                        sorts: [{ property: "Time", direction: "descending" }]
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
