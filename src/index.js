export default {
  async fetch(request, env) {
    if (request.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return new Response("Invalid JSON", { status: 400 });
    }

    console.log("requestType:", body?.request?.type);
    console.log("intentName:", body?.request?.intent?.name);

    const requestType = body?.request?.type;

    if (requestType === "LaunchRequest") {
      return alexaResponse("Hola, soy tu asistente. ¿En qué te puedo ayudar?", true);
    }

    if (requestType === "SessionEndedRequest") {
      return alexaResponse("Hasta luego.", false);
    }

    if (requestType === "IntentRequest") {
      const intentName = body?.request?.intent?.name;

      if (intentName === "AMAZON.StopIntent" || intentName === "AMAZON.CancelIntent") {
        return alexaResponse("Hasta luego.", false);
      }

      if (intentName === "AskGrokIntent" || intentName === "AMAZON.FallbackIntent") {
        // Intenta obtener la pregunta del slot, o del input de voz directo
        const pregunta =
          body?.request?.intent?.slots?.pregunta?.value ||
          body?.request?.intent?.slots?.["AMAZON.SearchQuery"]?.value ||
          body?.request?.speechInput?.value ||
          null;

        console.log("Pregunta capturada:", pregunta);

        if (!pregunta) {
          return alexaResponse("No escuché tu pregunta, ¿puedes repetirla?", true);
        }

        try {
          const deepseekRes = await fetch("https://api.deepseek.com/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${env.GROK_API_KEY}`
            },
            body: JSON.stringify({
              model: "deepseek-v4-flash",
              messages: [
                {
                  role: "system",
                  content: "Eres un asistente de voz. Responde de forma concisa, máximo 3 oraciones. Sin markdown, sin listas, solo texto plano."
                },
                {
                  role: "user",
                  content: pregunta
                }
              ],
              max_tokens: 300,
              stream: false
            })
          });

          const data = await deepseekRes.json();
          console.log("Respuesta de DeepSeek:", JSON.stringify(data));
          const respuesta = data?.choices?.[0]?.message?.content;

          if (!respuesta) throw new Error("Sin respuesta de DeepSeek");

          return alexaResponse(respuesta, true);

        } catch (err) {
          console.log("Error:", err.message);
          return alexaResponse("Hubo un error consultando al asistente. Intenta de nuevo.", false);
        }
      }
    }

    return alexaResponse("No entendí eso. Intenta de nuevo.", true);
  }
};

function alexaResponse(text, keepSession) {
  return new Response(
    JSON.stringify({
      version: "1.0",
      response: {
        outputSpeech: {
          type: "PlainText",
          text
        },
        shouldEndSession: !keepSession
      }
    }),
    {
      headers: { "Content-Type": "application/json" }
    }
  );
}