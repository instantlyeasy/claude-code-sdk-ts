import { AuthAnthropic } from "@instantlyeasy/claude-code-sdk-ts";
import { createInterface } from "readline";

async function main() {
  console.log("Claude Code SDK - In-Memory Authentication Example\n");
  console.log("This example stores credentials in memory only (no files).\n");

  console.log("🔐 Starting authentication flow...\n");

  // Start the auth flow
  const { url, verifier } = await AuthAnthropic.authorize("max");

  console.log("📋 Please follow these steps:");
  console.log("1. Open this URL in your browser:");
  console.log(`   ${url}\n`);
  console.log("2. Sign in to your Anthropic account");
  console.log("3. Authorize the application");
  console.log("4. Copy the authorization code from the callback page\n");

  let code;
  while (true) {
    code = await askQuestion("📝 Paste the authorization code here: ");
    if (!code) {
      console.log("❌ No code provided");
      continue;
    }
    break;
  }

  try {
    console.log("🔄 Exchanging code for tokens...");
    const credentials = await AuthAnthropic.exchange(code.trim(), verifier);

    console.log("\n✅ Authentication successful!");
    console.log("\n📋 Your credentials (save these securely):");
    console.log("=" .repeat(60));
    console.log(JSON.stringify({
      type: "oauth",
      refresh: credentials.refresh,
      access: credentials.access,
      expires: credentials.expires,
      expiresAt: new Date(credentials.expires).toISOString()
    }, null, 2));
    console.log("=" .repeat(60));
    console.log("\n⚠️  These credentials are not saved to disk!");
    console.log("💡 To use them later, save the JSON above to a secure location.");
    
    // Example of how to refresh the token
    console.log("\n🔄 Testing token refresh...");
    const refreshedCredentials = await AuthAnthropic.refresh(credentials.refresh);
    console.log("✅ Token refresh successful!");
    console.log(`🔑 New access token: ${refreshedCredentials.access.substring(0, 20)}...`);
    console.log(`📅 New expiry: ${new Date(refreshedCredentials.expires).toISOString()}`);
    
  } catch (error) {
    console.error("❌ Authentication failed:", error.message);
    process.exit(1);
  }
}

function askQuestion(question: string): Promise<string> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

main().catch(console.error);