import { createFileRoute } from "@tanstack/react-router";
import { AshveilApp } from "@/components/ashveil/App";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  return <AshveilApp />;
}
