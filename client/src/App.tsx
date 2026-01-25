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
import TaskComplete from "./pages/TaskComplete";
import MasterControl from "./pages/MasterControl";
import StaffTasks from "./pages/StaffTasks";
import Reports from "./pages/Reports";
import ReportForm from "./pages/ReportForm";
import ReportStaffManagement from "./pages/ReportStaffManagement";
import ReportAnalysis from "./pages/ReportAnalysis";
import BrandList from "./pages/BrandList";
import BrandForm from "./pages/BrandForm";
import BrandDetail from "./pages/BrandDetail";
import BusinessCards from "./pages/BusinessCards";
import ChatReport from "./pages/ChatReport";
import LineManagement from "./pages/LineManagement";
import LineFollowUps from "./pages/LineFollowUps";
import PendingResponses from "./pages/PendingResponses";
import Calendar from "./pages/Calendar";
import PublicSchedule from "./pages/PublicSchedule";
import PublicLiverSchedule from "./pages/PublicLiverSchedule";
import LiverRegister from "./pages/LiverRegister";
import LiverLogin from "./pages/LiverLogin";
import LiverList from "./pages/LiverList";
import LiverDetail from "./pages/LiverDetail";
import LivestreamDetail from "./pages/LivestreamDetail";
import LiverRecord from "./pages/LiverRecord";

function Router() {
  return (
    <Switch>
      <Route path={"/login"} component={Login} />
      <Route path="/complete/:token" component={TaskComplete} />
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
      <Route path={"/master-control"}>
        <DashboardLayout>
          <MasterControl />
        </DashboardLayout>
      </Route>
      <Route path={"/staff/:staffId/tasks"}>
        <DashboardLayout>
          <StaffTasks />
        </DashboardLayout>
      </Route>
      <Route path={"/tasks/staff/:staffId"}>
        {(params) => (
          <DashboardLayout>
            <StaffTasks />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/reports"}>
        <DashboardLayout>
          <Reports />
        </DashboardLayout>
      </Route>
      <Route path={"/reports/new"}>
        <DashboardLayout>
          <ReportForm />
        </DashboardLayout>
      </Route>
      <Route path={"/reports/chat"}>
        <DashboardLayout>
          <ChatReport />
        </DashboardLayout>
      </Route>
      <Route path={"/reports/edit/:id"}>
        <DashboardLayout>
          <ReportForm />
        </DashboardLayout>
      </Route>
      <Route path={"/report-staff"}>
        <DashboardLayout>
          <ReportStaffManagement />
        </DashboardLayout>
      </Route>
      <Route path={"/report-analysis"}>
        <DashboardLayout>
          <ReportAnalysis />
        </DashboardLayout>
      </Route>
      <Route path={"/brands"}>
        <BrandList />
      </Route>
      <Route path={"/brands/new"}>
        <DashboardLayout>
          <BrandForm />
        </DashboardLayout>
      </Route>
      <Route path={"/brands/:id/edit"}>
        {(params) => (
          <DashboardLayout>
            <BrandForm />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/brands/:id"}>
        {(params) => (
          <BrandDetail />
        )}
      </Route>
      <Route path={"/business-cards"}>
        <DashboardLayout>
          <BusinessCards />
        </DashboardLayout>
      </Route>
      <Route path={"/line"}>
        <DashboardLayout>
          <LineManagement />
        </DashboardLayout>
      </Route>
      <Route path={"/line/follow-ups"}>
        <DashboardLayout>
          <LineFollowUps />
        </DashboardLayout>
      </Route>
      <Route path={"/line/pending"}>
        <DashboardLayout>
          <PendingResponses />
        </DashboardLayout>
      </Route>
      <Route path={"/calendar"}>
        <DashboardLayout>
          <Calendar />
        </DashboardLayout>
      </Route>
      <Route path={"/s"} component={PublicSchedule} />
      <Route path={"/s/:name"} component={PublicLiverSchedule} />
      <Route path={"/livers"}>
        <DashboardLayout>
          <LiverList />
        </DashboardLayout>
      </Route>
      <Route path={"/livers/:id"}>
        <DashboardLayout>
          <LiverDetail />
        </DashboardLayout>
      </Route>
      <Route path={"/livestreams/:id"}>
        <DashboardLayout>
          <LivestreamDetail />
        </DashboardLayout>
      </Route>
      <Route path={"/livers/:id/record"}>
        <DashboardLayout>
          <LiverRecord />
        </DashboardLayout>
      </Route>
      {/* Liver login pages redirect to main login */}
      <Route path={"/liver/register"}>
        {() => {
          window.location.href = "/login";
          return null;
        }}
      </Route>
      <Route path={"/liver/login"}>
        {() => {
          window.location.href = "/login";
          return null;
        }}
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
