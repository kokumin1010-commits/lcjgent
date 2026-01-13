import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import TaskList from "./pages/TaskList";
import TaskCreate from "./pages/TaskCreate";
import TaskDetail from "./pages/TaskDetail";
import StaffManagement from "./pages/StaffManagement";
import Login from "./pages/Login";

function Router() {
  return (
    <Switch>
      <Route path={"/login"} component={Login} />
      <Route path={"/"}>
        <DashboardLayout>
          <Dashboard />
        </DashboardLayout>
      </Route>
      <Route path={"/tasks"}>
        <DashboardLayout>
          <TaskList />
        </DashboardLayout>
      </Route>
      <Route path={"/tasks/create"}>
        <DashboardLayout>
          <TaskCreate />
        </DashboardLayout>
      </Route>
      <Route path={"/tasks/:id"}>
        {(params) => (
          <DashboardLayout>
            <TaskDetail taskId={parseInt(params.id)} />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/staff"}>
        <DashboardLayout>
          <StaffManagement />
        </DashboardLayout>
      </Route>
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
