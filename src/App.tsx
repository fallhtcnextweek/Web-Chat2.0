import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { ChatApp } from "./components/ChatApp";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ThemeToggle } from "./components/ThemeToggle";

export default function App() {
  return (
    <ThemeProvider>
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-900 transition-colors">
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm h-16 flex justify-between items-center border-b border-gray-200 dark:border-gray-700 shadow-sm px-4">
          <h2 className="text-xl font-semibold text-primary dark:text-blue-400">ТопЧат</h2>
          <div className="flex items-center space-x-3">
            <ThemeToggle />
            <Authenticated>
              <SignOutButton />
            </Authenticated>
          </div>
        </header>
        <main className="flex-1">
          <Content />
        </main>
        <Toaster theme="system" />
      </div>
    </ThemeProvider>
  );
}

function Content() {
  const loggedInUser = useQuery(api.auth.loggedInUser);

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary dark:border-blue-400"></div>
      </div>
    );
  }

  return (
    <>
      <Authenticated>
        <ChatApp />
      </Authenticated>
      <Unauthenticated>
        <div className="flex items-center justify-center h-full">
          <div className="w-full max-w-md mx-auto p-8">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-primary dark:text-blue-400 mb-4">Добро Пожаловать!</h1>
              <p className="text-xl text-secondary dark:text-gray-300">Войдите в аккаунт чтобы начать</p>
            </div>
            <SignInForm />
          </div>
        </div>
      </Unauthenticated>
    </>
  );
}
