import Explorer from "./explorer";
import { getChatGPTUser, chatGPTSignInPath } from "./chatgpt-auth";
export const dynamic = "force-dynamic";
export default async function Home() {
  const user = await getChatGPTUser();
  return <Explorer signedIn={!!user} signInHref={chatGPTSignInPath("/")} />;
}
