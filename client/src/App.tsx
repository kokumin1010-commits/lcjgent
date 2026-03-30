import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { useReferralCapture } from "./hooks/useReferralCapture";
import RandomSpinProvider from "./components/RandomSpinProvider";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import { lazy, Suspense } from "react";

// 即時ロードが必要なコンポーネント（最初に表示される可能性が高いもの）
import MallHome from "./pages/MallHome";
import NotFound from "@/pages/NotFound";

// Lazy loading - 必要になったときだけロードする
const Dashboard = lazy(() => import("./pages/Dashboard"));
const TaskList = lazy(() => import("./pages/TaskList"));
const TaskCreate = lazy(() => import("./pages/TaskCreate"));
const TaskDetail = lazy(() => import("./pages/TaskDetail"));
const StaffManagement = lazy(() => import("./pages/StaffManagement"));
const Login = lazy(() => import("./pages/Login"));
const TaskComplete = lazy(() => import("./pages/TaskComplete"));
const MasterControl = lazy(() => import("./pages/MasterControl"));
const StaffTasks = lazy(() => import("./pages/StaffTasks"));
const Reports = lazy(() => import("./pages/Reports"));
const ReportForm = lazy(() => import("./pages/ReportForm"));
const ReportStaffManagement = lazy(() => import("./pages/ReportStaffManagement"));
const ReportAnalysis = lazy(() => import("./pages/ReportAnalysis"));
const BrandList = lazy(() => import("./pages/BrandList"));
const BrandForm = lazy(() => import("./pages/BrandForm"));
const BrandDetail = lazy(() => import("./pages/BrandDetail"));
const BrandFinance = lazy(() => import("./pages/BrandFinance"));
const FinanceManagement = lazy(() => import("./pages/FinanceManagement"));
const BusinessCards = lazy(() => import("./pages/BusinessCards"));
const ChatReport = lazy(() => import("./pages/ChatReport"));
const LineManagement = lazy(() => import("./pages/LineManagement"));
const LineFollowUps = lazy(() => import("./pages/LineFollowUps"));
const PendingResponses = lazy(() => import("./pages/PendingResponses"));
const Calendar = lazy(() => import("./pages/Calendar"));
const PublicSchedule = lazy(() => import("./pages/PublicSchedule"));
const PublicLiverSchedule = lazy(() => import("./pages/PublicLiverSchedule"));
const LiverRegister = lazy(() => import("./pages/LiverRegister"));
const LiverLogin = lazy(() => import("./pages/LiverLogin"));
const LiverList = lazy(() => import("./pages/LiverList"));
const LiverDetail = lazy(() => import("./pages/LiverDetail"));
const LivestreamDetail = lazy(() => import("./pages/LivestreamDetail"));
const LiverRecord = lazy(() => import("./pages/LiverRecord"));
const LiverMypage = lazy(() => import("./pages/LiverMypage"));
const LiverSelfRecord = lazy(() => import("./pages/LiverSelfRecord"));
const LivestreamEdit = lazy(() => import("./pages/LivestreamEdit"));
const LiverSchedule = lazy(() => import("./pages/LiverSchedule"));
const LiverSetApplication = lazy(() => import("./pages/LiverSetApplication"));
const LiverSampleRequest = lazy(() => import("./pages/LiverSampleRequest"));
const LiverProfile = lazy(() => import("./pages/LiverProfile"));
const LineReceiptManagement = lazy(() => import("./pages/LineReceiptManagement"));
const LineLogin = lazy(() => import("./pages/LineLogin"));
const LineLoginCallback = lazy(() => import("./pages/LineLoginCallback"));
const LineMypage = lazy(() => import("./pages/LineMypage"));
const ProductManagement = lazy(() => import("./pages/ProductManagement"));
const OrderManagement = lazy(() => import("./pages/OrderManagement"));
const MallMembers = lazy(() => import("./pages/MallMembers"));
const MallProducts = lazy(() => import("./pages/MallProducts"));
const MallProductDetail = lazy(() => import("./pages/MallProductDetail"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const ForgotPasswordAdmin = lazy(() => import("./pages/ForgotPasswordAdmin"));
const ResetPasswordAdmin = lazy(() => import("./pages/ResetPasswordAdmin"));
const PointRequest = lazy(() => import("./pages/PointRequest"));
const PointRequestAdmin = lazy(() => import("./pages/PointRequestAdmin"));
const ScheduleGroupManagement = lazy(() => import("./pages/ScheduleGroupManagement"));
const LiverByName = lazy(() => import("./pages/LiverByName"));
const LiverForgotPassword = lazy(() => import("./pages/LiverForgotPassword"));
const LiverResetPassword = lazy(() => import("./pages/LiverResetPassword"));
const LiverDashboard = lazy(() => import("./pages/LiverDashboard"));
const LiverDashboardNew = lazy(() => import("./pages/LiverDashboardNew"));
const LiverDetailNew = lazy(() => import("./pages/LiverDetailNew"));
const Simulator = lazy(() => import("./pages/Simulator"));
const ProposalPage = lazy(() => import("./pages/ProposalPage"));
const HRManagement = lazy(() => import("./pages/HRManagement"));
const ReceiptUpload = lazy(() => import("./pages/ReceiptUpload"));
const MallBrandCategoryManagement = lazy(() => import("./pages/MallBrandCategoryManagement"));
const CheckoutSuccess = lazy(() => import("./pages/CheckoutSuccess"));
const CheckoutCancel = lazy(() => import("./pages/CheckoutCancel"));
const ReferralManagement = lazy(() => import("./pages/ReferralManagement"));
const MallCart = lazy(() => import("./pages/MallCart"));
const Tokushoho = lazy(() => import("./pages/Tokushoho"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const MallDashboardPage = lazy(() => import("./pages/MallDashboardPage"));
const AiLearningDashboard = lazy(() => import("./pages/AiLearningDashboard"));
const ReceiptHub = lazy(() => import("./pages/ReceiptHub"));
const ReceiptAnalytics = lazy(() => import("./pages/ReceiptAnalytics"));
const ProductRanking = lazy(() => import("./pages/ProductRanking"));
const ProductRequestsAdmin = lazy(() => import("./pages/ProductRequestsAdmin"));
const FriendReferralChallenge = lazy(() => import("./pages/FriendReferralChallenge"));
const Register = lazy(() => import("./pages/Register"));
const SpinDemo = lazy(() => import("./pages/SpinDemo"));
const ChatRegister = lazy(() => import("./pages/ChatRegister"));
const RegistrationBonus = lazy(() => import("./pages/RegistrationBonus"));
const MemberDetail = lazy(() => import("./pages/MemberDetail"));
const BulkInvoicePrint = lazy(() => import("./pages/BulkInvoicePrint"));
const BlogAdmin = lazy(() => import("./pages/BlogAdmin"));
const BlogEditor = lazy(() => import("./pages/BlogEditor"));
const BlogArticlePage = lazy(() => import("./pages/BlogArticlePage"));
const BlogListPage = lazy(() => import("./pages/BlogListPage"));
const BlogTagPage = lazy(() => import("./pages/BlogTagPage"));
const BrandListPage = lazy(() => import("./pages/BrandListPage"));
const BrandDetailPage = lazy(() => import("./pages/BrandDetailPage"));
const BrandAdditionLogs = lazy(() => import("./pages/BrandAdditionLogs"));
const RecruitmentManagement = lazy(() => import("./pages/RecruitmentManagement"));
const ReviewDatabase = lazy(() => import("./pages/ReviewDatabase"));
const ProductReviews = lazy(() => import("./pages/ProductReviews"));
const BeautyWallet = lazy(() => import("./pages/BeautyWallet"));
const KakuhenTest = lazy(() => import("./pages/KakuhenTest"));
const SetApplicationsAdmin = lazy(() => import("./pages/SetApplicationsAdmin"));
const SampleRequestsAdmin = lazy(() => import("./pages/SampleRequestsAdmin"));
const StepEmailTemplates = lazy(() => import("./pages/StepEmailTemplates"));
const StepEmailLogs = lazy(() => import("./pages/StepEmailLogs"));
const StepEmailAnalytics = lazy(() => import("./pages/StepEmailAnalytics"));
const BrandSampleLP = lazy(() => import("./pages/BrandSampleLP"));
const BrandApplications = lazy(() => import("./pages/BrandApplications"));
const AdFormSubmissions = lazy(() => import("./pages/AdFormSubmissions"));
const SalesCheck = lazy(() => import("./pages/SalesCheck"));
const AbTestDashboard = lazy(() => import("./pages/AbTestDashboard"));

// ページ遷移時のフォールバック（軽量スピナー）
function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
    </div>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        {/* LCJ MALL - Public Pages */}
        <Route path={"/"} component={MallHome} />
        <Route path="/line-login" component={LineLogin} />
        <Route path="/line-callback" component={LineLoginCallback} />
        <Route path="/forgot-password" component={ForgotPassword} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/mypage" component={LineMypage} />
        <Route path="/beauty-wallet" component={BeautyWallet} />
        <Route path="/mall/products" component={MallProducts} />
        <Route path="/mall/products/:id" component={MallProductDetail} />
        <Route path="/mall/cart" component={MallCart} />
        <Route path="/legal/tokushoho" component={Tokushoho} />
        <Route path="/legal/privacy" component={PrivacyPolicy} />
        <Route path="/mall/checkout/success" component={CheckoutSuccess} />
        <Route path="/mall/checkout/cancel" component={CheckoutCancel} />
        <Route path="/point-request" component={PointRequest} />
        <Route path="/receipt-upload" component={ReceiptUpload} />
        <Route path="/kakuhen-test" component={KakuhenTest} />
        <Route path="/ranking" component={ProductRanking} />
        <Route path="/reviews" component={ReviewDatabase} />
        <Route path="/reviews/product/:name" component={ProductReviews} />
        <Route path="/friend-challenge" component={FriendReferralChallenge} />
        <Route path="/spin-demo" component={SpinDemo} />
        <Route path="/register/:code" component={Register} />
        <Route path="/register" component={Register} />
        <Route path="/chat-register" component={ChatRegister} />
        <Route path="/registration-bonus" component={RegistrationBonus} />
        <Route path="/master/point-requests">
          <DashboardLayout>
            <PointRequestAdmin />
          </DashboardLayout>
        </Route>
        <Route path="/master/receipts">
          <DashboardLayout>
            <ReceiptHub />
          </DashboardLayout>
        </Route>
        <Route path="/master/receipt-analytics">
          <DashboardLayout>
            <ReceiptAnalytics />
          </DashboardLayout>
        </Route>
        <Route path="/master/product-requests">
          <DashboardLayout>
            <ProductRequestsAdmin />
          </DashboardLayout>
        </Route>
        
        {/* Authentication */}
        <Route path={"/login"} component={Login} />
        <Route path="/forgot-password-admin" component={ForgotPasswordAdmin} />
        <Route path="/reset-password-admin" component={ResetPasswordAdmin} />
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
        <Route path={"/master/brand-addition-logs"}>
          <BrandAdditionLogs />
        </Route>
        <Route path={"/master/brands"}>
          <BrandList />
        </Route>
        <Route path={"/master/recruitment"}>
          <RecruitmentManagement />
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
        <Route path={"/master/brands/:id/finance"}>
          {(params) => (
            <BrandFinance />
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
        <Route path={"/master/livers-dashboard"} component={LiverDashboardNew} />
        <Route path={"/master/sales-check"}>
          <DashboardLayout>
            <SalesCheck />
          </DashboardLayout>
        </Route>
        <Route path={"/master/simulator"} component={Simulator} />
        <Route path={"/master/set-applications"}>
          <DashboardLayout>
            <SetApplicationsAdmin />
          </DashboardLayout>
        </Route>
        <Route path={"/master/sample-requests"}>
          <DashboardLayout>
            <SampleRequestsAdmin />
          </DashboardLayout>
        </Route>
        <Route path={"/master/livers-dashboard/:id"} component={LiverDetailNew} />
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
        <Route path={"/master/mall/print"} component={BulkInvoicePrint} />
        <Route path={"/master/blog/new"} component={BlogEditor} />
        <Route path={"/master/blog/edit/:id"} component={BlogEditor} />
        <Route path={"/master/blog"} component={BlogAdmin} />
        <Route path={"/brands/:brandId"} component={BrandDetailPage} />
        <Route path={"/brands"} component={BrandListPage} />
        <Route path={"/blog/tag/:tagId"} component={BlogTagPage} />
        <Route path={"/blog/:slug"} component={BlogArticlePage} />
        <Route path={"/blog"} component={BlogListPage} />
        <Route path={"/master/mall/member/:id"} component={MemberDetail} />
        <Route path={"/master/mall"} component={MallDashboardPage} />
        <Route path={"/master/finance"}>
          <DashboardLayout>
            <FinanceManagement />
          </DashboardLayout>
        </Route>
        <Route path={"/master/hr"}>
          <DashboardLayout>
            <HRManagement />
          </DashboardLayout>
        </Route>
        <Route path={"/master/step-email/analytics"} component={StepEmailAnalytics} />
        <Route path={"/master/step-email/logs"} component={StepEmailLogs} />
        <Route path={"/master/step-email"} component={StepEmailTemplates} />
        <Route path={"/master/referral"} component={ReferralManagement} />
        <Route path={"/master/ai-learning"}>
          <DashboardLayout>
            <ReceiptHub />
          </DashboardLayout>
        </Route>
        
        {/* Public Pages - Proposal */}
        <Route path="/proposal/:token" component={ProposalPage} />
        
        {/* Public Pages - Schedule */}
        <Route path={"/s"} component={PublicSchedule} />
        <Route path={"/s/:name"} component={PublicLiverSchedule} />
        
        {/* Schedule Group Management */}
        <Route path={"/master/schedule-groups"} component={ScheduleGroupManagement} />
        
        {/* Public Pages - Liver */}
        <Route path={"/livers"} component={LiverList} />
        <Route path={"/livers/by-name/:name"} component={LiverByName} />
        <Route path={"/livers/:id/edit"} component={LiverProfile} />
        <Route path={"/livers/:id/record"} component={LiverSelfRecord} />
        <Route path={"/livers/:id"} component={LiverDetail} />
        <Route path={"/livestreams/:id"} component={LivestreamDetail} />
        
        {/* Liver Self-Service Pages */}
        <Route path={"/liver/register"} component={LiverRegister} />
        <Route path={"/liver/login"} component={LiverLogin} />
        <Route path={"/liver/mypage"} component={LiverMypage} />
        <Route path={"/liver/dashboard"} component={LiverDashboard} />
        <Route path={"/liver/profile"} component={LiverProfile} />
        <Route path={"/liver/edit"} component={LiverProfile} />
        <Route path={"/liver/record"} component={LiverSelfRecord} />
        <Route path={"/liver/schedule"} component={LiverSchedule} />
        <Route path={"/liver/set-application"} component={LiverSetApplication} />
        <Route path={"/liver/sample-request"} component={LiverSampleRequest} />
        <Route path={"/liver/forgot-password"} component={LiverForgotPassword} />
        <Route path={"/liver/reset-password"} component={LiverResetPassword} />
        
        <Route path="/master/brand-applications">
          <DashboardLayout>
            <BrandApplications />
          </DashboardLayout>
        </Route>

        <Route path="/master/ad-form-submissions">
          <DashboardLayout>
            <AdFormSubmissions />
          </DashboardLayout>
        </Route>

        {/* Brand Sample LP */}
        <Route path="/brand-sample" component={BrandSampleLP} />
        <Route path="/master/ab-test" component={AbTestDashboard} />
        
        {/* 404 */}
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function App() {
  useReferralCapture();
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <RandomSpinProvider>
            <Router />
          </RandomSpinProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
