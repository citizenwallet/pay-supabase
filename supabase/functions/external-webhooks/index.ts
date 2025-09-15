import { getServiceRoleClient } from "../_db/index.ts";
import { getWebhook, getWebhookSecret } from "../_db/webhooks.ts";

Deno.serve(async (req) => {
  //get the body
  const { record } = await req.json();

  //check if the record is valid
  if (!record || typeof record !== "object") {
    return new Response("Invalid record data", { status: 400 });
  }

  const supabaseClient = getServiceRoleClient();

  // Fetch the webhook from the database
  const { data, error } = await getWebhook(
    supabaseClient,
    record.dest,
    record.data.topic,
  );

  //check if the webhook has an error
  if (error) {
    console.error("Error getting webhooks subscriptions", error);
    return new Response("Error getting webhooks subscriptions", {
      status: 500,
    });
  }

  //check if the webhook has data
  if (data.length === 0) {
    console.error(
      "No webhooks subscriptions found for event",
      record.data.topic,
    );
    return new Response("No webhooks subscriptions found for event", {
      status: 404,
    });
  }

  // Send all webhooks requests
  for (const webhook of data) {
    //for get the alias
    const alias = webhook.alias;

    // Fetch the webhook secret from the database
    const { data: webhookSecretData, error: webhookSecretError } =
      await getWebhookSecret(supabaseClient, alias);

    //check if the webhook secret has an error
    if (webhookSecretError) {
      console.error("Error fetching webhook secret", webhookSecretError);
      continue;
    }

    //check if the webhook secret has data
    if (!webhookSecretData || webhookSecretData.length === 0) {
      console.error("No webhook secret found for alias:", alias);
      continue;
    }

    //get the webhook secret key
    const webhookSecretKey = webhookSecretData[0].secret;

    // Create an AbortController to enable request cancellation
    // Set a timeout to automatically abort the operation after 10 seconds
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    //send the webhook request
    try {
      const webhookUrl = webhook.url;
      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${webhookSecretKey}`,
        },
        body: JSON.stringify(record),
        signal: controller.signal,
      });

      // Clean up timeout if fetch completes
      clearTimeout(timeoutId);

      if (!response.ok) {
        //log the webhook response has error,then it continue to the next webhook
        console.error(
          `Webhook request to ${webhook.url} failed with status ${response.status}: ${response.statusText}`,
        );
        continue;
      }

      const responseText = await response.text();
      console.log(`Webhook to ${webhook.url} succeeded:`, responseText);
    } catch (err) {
      clearTimeout(timeoutId);

      if (err.name === "AbortError") {
        console.error(`Webhook request to ${webhook.url} timed out`);
      } else {
        console.error(`Error sending webhook request to ${webhook.url}:`, err);
      }
      continue;
    }
  }

  return new Response("OK", { status: 200 });
});
