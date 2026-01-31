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
import LiverMypage from "./pages/LiverMypage";
import LiverSelfRecord from "./pages/LiverSelfRecord";
import LivestreamEdit from "./pages/LivestreamEdit";
import LiverSchedule from "./pages/LiverSchedule";
import LiverProfile from "./pages/LiverProfile";
import MyPoints from "./pages/MyPoints";
import ReceiptManagement from "./pages/ReceiptManagement";
import LineReceiptManagement from "./pages/LineReceiptManagement";
import MallHome from "./pages/MallHome";
import LineLogin from "./pages/LineLogin";
import LineLoginCallback from "./pages/LineLoginCallback";
import LineMypage from "./pages/LineMypage";
import ProductManagement from "./pages/ProductManagement";
import MallProducts from "./pages/MallProducts";
import MallProductDetail from "./pages/MallProductDetail";

function Router() {
  return (
    <Switch>
      {/* LCJ MALL - Public Pages */}
      <Route path={"/"} component={MallHome} />
      <Route path="/line-login" component={LineLogin} />
      <Route path="/line-callback" component={LineLoginCallback} />
      <Route path="/mypage" component={LineMypage} />
      <Route path="/mall/products" component={MallProducts} />
      <Route path="/mall/products/:id" component={MallProductDetail} />
      
      {/* Authentication */}
      <Route path={"/login"} component={Login} />
      <Route path="/complete/:token" component={TaskComplete} />
      
      {/* Master - Admin Dashboard */}
      <Route path={"/master"}>
        <DashboardLayout>
          <Dashboard />
        </DashboardLayout>
      </Route>
      <Route path={"/master/tasks"}>
        <DashboardLayout>
          <TaskList />
        </DashboardLayout>
      </Route>
      <Route path={"/master/tasks/create"}>
        <DashboardLayout>
          <TaskCreate />
        </DashboardLayout>
      </Route>
      <Route path={"/master/tasks/:id"}>
        {(params) => (
          <DashboardLayout>
            <TaskDetail taskId={parseInt(params.id)} />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/master/staff"}>
        <DashboardLayout>
          <StaffManagement />
        </DashboardLayout>
      </Route>
      <Route path={"/master/control"}>
        <DashboardLayout>
          <MasterControl />
        </DashboardLayout>
      </Route>
      <Route path={"/master/staff/:staffId/tasks"}>
        <DashboardLayout>
          <StaffTasks />
        </DashboardLayout>
      </Route>
      <Route path={"/master/tasks/staff/:staffId"}>
        {(params) => (
          <DashboardLayout>
            <StaffTasks />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/master/reports"}>
        <DashboardLayout>
          <Reports />
        </DashboardLayout>
      </Route>
      <Route path={"/master/reports/new"}>
        <DashboardLayout>
          <ReportForm />
        </DashboardLayout>
      </Route>
      <Route path={"/master/reports/chat"}>
        <DashboardLayout>
          <ChatReport />
        </DashboardLayout>
      </Route>
      <Route path={"/master/reports/edit/:id"}>
        <DashboardLayout>
          <ReportForm />
        </DashboardLayout>
      </Route>
      <Route path={"/master/report-staff"}>
        <DashboardLayout>
          <ReportStaffManagement />
        </DashboardLayout>
      </Route>
      <Route path={"/master/report-analysis"}>
        <DashboardLayout>
          <ReportAnalysis />
        </DashboardLayout>
      </Route>
      <Route path={"/master/brands"}>
        <BrandList />
      </Route>
      <Route path={"/master/brands/new"}>
        <DashboardLayout>
          <BrandForm />
        </DashboardLayout>
      </Route>
      <Route path={"/master/brands/:id/edit"}>
        {(params) => (
          <DashboardLayout>
            <BrandForm />
          </DashboardLayout>
        )}
      </Route>
      <Route path={"/master/brands/:id"}>
        {(params) => (
          <BrandDetail />
        )}
      </Route>
      <Route path={"/master/business-cards"}>
        <DashboardLayout>
          <BusinessCards />
        </DashboardLayout>
      </Route>
      <Route path={"/master/line"}>
        <DashboardLayout>
          <LineManagement />
        </DashboardLayout>
      </Route>
      <Route path={"/master/line/follow-ups"}>
        <DashboardLayout>
          <LineFollowUps />
        </DashboardLayout>
      </Route>
      <Route path={"/master/line/pending"}>
        <DashboardLayout>
          <PendingResponses />
        </DashboardLayout>
      </Route>
      <Route path={"/master/calendar"}>
        <DashboardLayout>
          <Calendar />
        </DashboardLayout>
      </Route>
      <Route path={"/master/livers"} component={LiverList} />
      <Route path={"/master/livers/:id"} component={LiverDetail} />
      <Route path={"/master/livestreams/:id"} component={LivestreamDetail} />
      <Route path={"/master/livers/livestream/:id/edit"}>
        <DashboardLayout>
          <LivestreamEdit />
        </DashboardLayout>
      </Route>
      <Route path={"/master/livers/:id/record"}>
        <DashboardLayout>
          <LiverRecord />
        </DashboardLayout>
      </Route>
      <Route path={"/master/points"}>
        <DashboardLayout>
          <MyPoints />
        </DashboardLayout>
      </Route>
      <Route path={"/master/receipts"}>
        <DashboardLayout>
          <ReceiptManagement />
        </DashboardLayout>
      </Route>
      <Route path={"/master/line-receipts"}>
        <DashboardLayout>
          <LineReceiptManagement />
        </DashboardLayout>
      </Route>
      <Route path={"/master/products"}>
        <DashboardLayout>
          <ProductManagement />
        </DashboardLayout>
      </Route>
      
      {/* Public Pages - Schedule */}
      <Route path={"/s"} component={PublicSchedule} />
      <Route path={"/s/:name"} component={PublicLiverSchedule} />
      
      {/* Public Pages - Liver */}
      <Route path={"/livers"} component={LiverList} />
      <Route path={"/livers/:id"} component={LiverDetail} />
      <Route path={"/livestreams/:id"} component={LivestreamDetail} />
      
      {/* Liver Self-Service Pages */}
      <Route path={"/liver/register"} component={LiverRegister} />
      <Route path={"/liver/login"} component={LiverLogin} />
      <Route path={"/liver/mypage"} component={LiverMypage} />
      <Route path={"/liver/profile"} component={LiverProfile} />
      <Route path={"/liver/record"} component={LiverSelfRecord} />
      <Route path={"/liver/schedule"} component={LiverSchedule} />
      
      {/* 404 */}
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
