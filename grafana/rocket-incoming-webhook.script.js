/* Rocket.Chat Incoming Webhook script for Grafana 11.3 generic webhook alerts.
 *
 * In Rocket.Chat: Administration → Workspace → Integrations → Incoming Webhook
 * - Enable "Script Enabled"
 * - Paste this entire file into the Script field
 *
 * Grafana posts a fixed envelope (version, title, message, state, …).
 * Without this script, Rocket expects top-level `text`/`msg` and the channel
 * message is empty while Grafana still records HTTP 2xx.
 */
class Script {
  process_incoming_request({ request }) {
    const content = request.content || {};

    if (content.version !== "1" && content.version !== 1) {
      return {
        error: "Unsupported Grafana webhook payload (expected version 1)",
      };
    }

    const attachment = {
      title: content.title || "Grafana alert",
      text: content.message || "",
    };

    if (content.externalURL) {
      attachment.title_link = content.externalURL;
    }

    switch (content.state) {
      case "ok":
        attachment.color = "#36a64f";
        break;
      case "alerting":
        attachment.color = "#D63232";
        break;
      default:
        attachment.color = "#888888";
        break;
    }

    return {
      content: {
        username: "Grafana Monitor",
        attachments: [attachment],
      },
    };
  }
}
