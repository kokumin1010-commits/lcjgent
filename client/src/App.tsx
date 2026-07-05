import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Route, Switch, Redirect } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { useReferralCapture } from "./hooks/useReferralCapture";
import RandomSpinProvider from "./components/RandomSpinProvider";
import { ThemeProvider } from "./contexts/ThemeContext";
import DashboardLayout from "./components/DashboardLayout";
import ProtectedLiverRoute from "./components/ProtectedLiverRoute";
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
const BusinessCardProfile = lazy(() => import("./pages/BusinessCardProfile"));
const EmailThread = lazy(() => import("./pages/EmailThread"));
const ChatReport = lazy(() => import("./pages/ChatReport"));
const LineManagement = lazy(() => import("./pages/LineManagement"));
const LineFollowUps = lazy(() => import("./pages/LineFollowUps"));
const PendingResponses = lazy(() => import("./pages/PendingResponses"));
const Calendar = lazy(() => import("./pages/Calendar"));
const PublicSchedule = lazy(() => import("./pages/PublicSchedule"));
const MobmartSchedule = lazy(() => import("./pages/MobmartSchedule"));
const MobmartLiverList = lazy(() => import("./pages/MobmartLiverList"));
const LcjLiverList = lazy(() => import("./pages/LcjLiverList"));
const PublicLiverSchedule = lazy(() => import("./pages/PublicLiverSchedule"));
const LiverRegister = lazy(() => import("./pages/LiverRegister"));
const LiverLogin = lazy(() => import("./pages/LiverLogin"));
const LiverList = lazy(() => import("./pages/LiverList"));
const LiverDetail = lazy(() => import("./pages/LiverDetail"));
const LivestreamDetail = lazy(() => import("./pages/LivestreamDetail"));
const LivestreamRealtimeRecord = lazy(() => import("./pages/LivestreamRealtimeRecord"));
const LiverRecord = lazy(() => import("./pages/LiverRecord"));
const LiverMypage = lazy(() => import("./pages/LiverMypage"));
const LiverSelfRecord = lazy(() => import("./pages/LiverSelfRecord"));
const LivestreamEdit = lazy(() => import("./pages/LivestreamEdit"));
const LiverSchedule = lazy(() => import("./pages/LiverSchedule"));
const LiverSetApplication = lazy(() => import("./pages/LiverSetApplication"));
const LiverSampleRequest = lazy(() => import("./pages/LiverSampleRequest"));
const LiverProfile = lazy(() => import("./pages/LiverProfile"));
const LiverEditAdmin = lazy(() => import("./pages/LiverEditAdmin"));
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
const LiverProductSelect = lazy(() => import("./pages/LiverProductSelect"));
const LiverProductCatalog = lazy(() => import("./pages/LiverProductCatalog"));
const LiverDashboard = lazy(() => import("./pages/LiverDashboard"));
const LiverAiCoach = lazy(() => import("./pages/LiverAiCoach"));
const LiverLineSetup = lazy(() => import("./pages/LiverLineSetup"));
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
const MasterSetSuggestions = lazy(() => import("./pages/MasterSetSuggestions"));
const SampleRequestsAdmin = lazy(() => import("./pages/SampleRequestsAdmin"));
const StepEmailTemplates = lazy(() => import("./pages/StepEmailTemplates"));
const StepEmailLogs = lazy(() => import("./pages/StepEmailLogs"));
const StepEmailAnalytics = lazy(() => import("./pages/StepEmailAnalytics"));
const BrandSampleLP = lazy(() => import("./pages/BrandSampleLP"));
const BrandApplications = lazy(() => import("./pages/BrandApplications"));
const AdFormSubmissions = lazy(() => import("./pages/AdFormSubmissions"));
const SalesCheck = lazy(() => import("./pages/SalesCheck"));
const AbTestDashboard = lazy(() => import("./pages/AbTestDashboard"));
const AgencyLogin = lazy(() => import("./pages/AgencyLogin"));
const AgencyDashboard = lazy(() => import("./pages/AgencyDashboard"));
const AgencyManagement = lazy(() => import("./pages/AgencyManagement"));
const AgencyLiverRegister = lazy(() => import("./pages/AgencyLiverRegister"));
const BrandPortal = lazy(() => import("./pages/BrandPortal"));
const BrandSimulationView = lazy(() => import("./pages/BrandSimulationView"));
const BrandPortalAdmin = lazy(() => import("./pages/BrandPortalAdmin"));
const AdDashboard = lazy(() => import("./pages/AdDashboard"));
const Recruit = lazy(() => import("./pages/Recruit"));
const ProductVote = lazy(() => import("./pages/ProductVote"));
const ShortVideoMatrix = lazy(() => import("./pages/ShortVideoMatrix"));
const LcjCoinDashboard = lazy(() => import("./pages/LcjCoinDashboard"));
const LcjCoinMyLogin = lazy(() => import("./pages/LcjCoinMyLogin"));
const LcjCoinMyPage = lazy(() => import("./pages/LcjCoinMyPage"));
const LiveSuggestions = lazy(() => import("./pages/LiveSuggestions"));
const AiCoachMaster = lazy(() => import("./pages/AiCoachMaster"));
const MegaChannelAdmin = lazy(() => import("./pages/MegaChannelAdmin"));
const FeaturedProductsAdmin = lazy(() => import("./pages/FeaturedProductsAdmin"));
const LcjBrain = lazy(() => import("./pages/LcjBrain"));
const Chat = lazy(() => import("./pages/Chat"));
const ChatInvite = lazy(() => import("./pages/ChatInvite"));
const LiveCommerceFestivalTop = lazy(() => import("./pages/LiveCommerceFestivalTop"));
const LiveCommerceFestival = lazy(() => import("./pages/LiveCommerceFestival"));
const FestivalApplyCompany = lazy(() => import("./pages/FestivalApplyCompany"));
const FestivalApplyLiver = lazy(() => import("./pages/FestivalApplyLiver"));
const FestivalApplyGeneral = lazy(() => import("./pages/FestivalApplyGeneral"));
const FestivalAdmin = lazy(() => import("./pages/FestivalAdmin"));
const ProductLab = lazy(() => import("./pages/ProductLab"));
const SelectionCenter = lazy(() => import("./pages/SelectionCenter"));
const AccountManagement = lazy(() => import("./pages/AccountManagement"));
const BarcodeScanner = lazy(() => import("./pages/BarcodeScanner"));

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
        
        {/* Redirect legacy /master/products to /master/mall?tab=products */}
        <Route path={"/master/products"}>
          <Redirect to="/master/mall?tab=products" />
        </Route>
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
        <Route path={"/master/business-cards/:id"}>
          <DashboardLayout>
            <BusinessCardProfile />
          </DashboardLayout>
        </Route>
        <Route path={"/master/email-thread/:email"}>
          <EmailThread />
        </Route>
        <Route path={"/master/line"}>
          <DashboardLayout>
            <LineManagement />
          </DashboardLayout>
        </Route>
        <Route path={"/master/line/follow-ups"}>
          <Redirect to="/master/line?tab=follow-ups" />
        </Route>
        <Route path={"/master/line/pending"}>
          <Redirect to="/master/line?tab=pending" />
        </Route>
        {/* /master/calendar は廃止 - /s を使用 */}
        {/* <Route path={"/master/calendar"}>
          <DashboardLayout>
            <Calendar />
          </DashboardLayout>
        </Route> */}
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
        <Route path={"/master/set-suggestions"}>
          <DashboardLayout>
            <MasterSetSuggestions />
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
        <Route path={"/master/livestreams/:id/realtime"} component={LivestreamRealtimeRecord} />
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
        <Route path={"/mobmart/s"} component={MobmartSchedule} />
        <Route path={"/mobmart/livers"} component={MobmartLiverList} />
        
        {/* Schedule Group Management */}
        <Route path={"/master/schedule-groups"} component={ScheduleGroupManagement} />
        <Route path={"/master/live-suggestions"} component={LiveSuggestions} />
        
        {/* Protected Liver Pages - ライバーまたは管理者のみアクセス可能 */}
        <Route path={"/livers"}>
          <ProtectedLiverRoute>
            <LcjLiverList />
          </ProtectedLiverRoute>
        </Route>
        <Route path={"/livers/by-name/:name"} component={LiverByName} />
        <Route path={"/livers/:id/edit"}>
          <ProtectedLiverRoute>
            <LiverEditAdmin />
          </ProtectedLiverRoute>
        </Route>
        <Route path={"/livers/:id/record"}>
          <ProtectedLiverRoute>
            <LiverSelfRecord />
          </ProtectedLiverRoute>
        </Route>
        <Route path={"/livers/:id"}>
          <ProtectedLiverRoute>
            <LiverDetail />
          </ProtectedLiverRoute>
        </Route>
        <Route path={"/livestreams/:id"}>
          <ProtectedLiverRoute>
            <LivestreamDetail />
          </ProtectedLiverRoute>
        </Route>
        
        {/* Liver Self-Service Pages - 認証が必要なページ */}
        <Route path={"/liver/register"} component={LiverRegister} />
        <Route path={"/liver/login"} component={LiverLogin} />
        <Route path={"/liver/forgot-password"} component={LiverForgotPassword} />
        <Route path={"/liver/reset-password"} component={LiverResetPassword} />
        <Route path={"/liver/mypage"}>
          <ProtectedLiverRoute>
            <LiverMypage />
          </ProtectedLiverRoute>
        </Route>
        <Route path={"/liver/dashboard"}>
          <ProtectedLiverRoute>
            <LiverDashboard />
          </ProtectedLiverRoute>
        </Route>
        <Route path={"/liver/profile"}>
          <ProtectedLiverRoute>
            <LiverProfile />
          </ProtectedLiverRoute>
        </Route>
        <Route path={"/liver/edit"}>
          <ProtectedLiverRoute>
            <LiverProfile />
          </ProtectedLiverRoute>
        </Route>
        <Route path={"/liver/record"}>
          <ProtectedLiverRoute>
            <LiverSelfRecord />
          </ProtectedLiverRoute>
        </Route>
        <Route path={"/liver/schedule"}>
          <ProtectedLiverRoute>
            <LiverSchedule />
          </ProtectedLiverRoute>
        </Route>
        <Route path={"/liver/set-application"}>
          <ProtectedLiverRoute>
            <LiverSetApplication />
          </ProtectedLiverRoute>
        </Route>
        <Route path={"/liver/sample-request"}>
          <ProtectedLiverRoute>
            <LiverSampleRequest />
          </ProtectedLiverRoute>
        </Route>
        <Route path={"/liver/coach"}>
          <ProtectedLiverRoute>
            <LiverAiCoach />
          </ProtectedLiverRoute>
        </Route>
        <Route path={"/liver/line-setup"}>
          <ProtectedLiverRoute>
            <LiverLineSetup />
          </ProtectedLiverRoute>
        </Route>
        <Route path={"/liver/products"}>
          <ProtectedLiverRoute>
            <LiverProductCatalog />
          </ProtectedLiverRoute>
        </Route>
        <Route path={"/liver/products/:brandId"}>
          <ProtectedLiverRoute>
            <LiverProductSelect />
          </ProtectedLiverRoute>
        </Route>
        
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
        <Route path="/recruit" component={Recruit} />
        <Route path="/brand-sample" component={BrandSampleLP} />

        {/* Product Vote (商品投票) */}
        <Route path="/vote/:id" component={ProductVote} />

        {/* Live Commerce Festival */}
        <Route path="/livecommercefestival/2026/apply/company" component={FestivalApplyCompany} />
        <Route path="/livecommercefestival/2026/apply/liver" component={FestivalApplyLiver} />
        <Route path="/livecommercefestival/2026/apply/general" component={FestivalApplyGeneral} />
        <Route path="/livecommercefestival/2026" component={LiveCommerceFestival} />
        <Route path="/livecommercefestival" component={LiveCommerceFestivalTop} />

        {/* Brand Portal */}
        <Route path="/brand/simulation/:shareToken" component={BrandSimulationView} />
        <Route path="/brand/:token" component={BrandPortal} />
        <Route path="/master/brand-portal">
          <DashboardLayout>
            <BrandPortalAdmin />
          </DashboardLayout>
        </Route>
        <Route path="/master/ab-test" component={AbTestDashboard} />
        <Route path="/master/ad-dashboard">
          <DashboardLayout>
            <AdDashboard />
          </DashboardLayout>
        </Route>

        {/* Agency (事務所) Pages */}
        <Route path="/agency/:agencyCode/liver/register" component={AgencyLiverRegister} />
        <Route path="/agency/login" component={AgencyLogin} />
        <Route path="/agency/dashboard" component={AgencyDashboard} />
        <Route path="/master/agencies">
          <DashboardLayout>
            <AgencyManagement />
          </DashboardLayout>
        </Route>
        <Route path="/master/short-video">
          <DashboardLayout>
            <ShortVideoMatrix />
          </DashboardLayout>
        </Route>
        <Route path="/master/lcj-coin">
          <LcjCoinDashboard />
        </Route>
        <Route path="/master/mega-channel" component={MegaChannelAdmin} />
        <Route path="/master/featured-products" component={FeaturedProductsAdmin} />
        <Route path="/master/ai-coach">
          <DashboardLayout>
            <AiCoachMaster />
          </DashboardLayout>
        </Route>
        <Route path="/master/festival">
          <DashboardLayout>
            <FestivalAdmin />
          </DashboardLayout>
        </Route>
        <Route path="/master/product-lab">
          <DashboardLayout>
            <ProductLab />
          </DashboardLayout>
        </Route>
        <Route path="/master/selection-center">
          <DashboardLayout>
            <SelectionCenter />
          </DashboardLayout>
        </Route>
        <Route path="/master/account-management">
          <DashboardLayout>
            <AccountManagement />
          </DashboardLayout>
        </Route>
        <Route path="/barcode-scanner" component={BarcodeScanner} />
        <Route path="/master/lcj-brain">
          <DashboardLayout>
            <LcjBrain />
          </DashboardLayout>
        </Route>
        {/* Chat Invite Links */}
        <Route path="/chat/invite/group/:roomId/:inviteCode" component={ChatInvite} />
        <Route path="/chat/invite/:userType/:userId" component={ChatInvite} />
        <Route path="/master/chat">
          <DashboardLayout>
            <Chat />
          </DashboardLayout>
        </Route>

        {/* Liver Chat */}
        <Route path="/liver/chat">
          <ProtectedLiverRoute>
            <Chat />
          </ProtectedLiverRoute>
        </Route>

        {/* LCJ Coin My Page */}
        <Route path="/my/lcj-coin/login" component={LcjCoinMyLogin} />
        <Route path="/my/lcj-coin" component={LcjCoinMyPage} />
        
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
