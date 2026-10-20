import { Routes, Route } from "react-router-dom";
import NavBar from "./components/NavBar";
import Footer from "./components/Footer";
import ChatWidget from "./chat/ChatWidget";
import ChatSearchResults from "./components/ChatSearchResults";
import ScrollToTop from "./components/ScrollToTop";
import Home from "./pages/Home";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import About from "./pages/About";
import Login from "./pages/Login";
import CreateAccount from "./pages/CreateAccount";
import { AuthProvider } from "./auth/AuthContext";
import { ChatSearchProvider } from "./chat/ChatSearchContext";
import { BagProvider } from "./bag/BagContext";
import BagDrawer from "./bag/BagDrawer";

function App() {
  return (
    <AuthProvider>
      <BagProvider>
        <ChatSearchProvider>
          <ScrollToTop />
          <NavBar />
          <ChatSearchResults />
          <main style={{ flex: 1 }}>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/products" element={<Products />} />
              <Route path="/products/:productId" element={<ProductDetail />} />
              <Route path="/about" element={<About />} />
              <Route path="/login" element={<Login />} />
              <Route path="/create-account" element={<CreateAccount />} />
            </Routes>
          </main>
          <Footer />
          <BagDrawer />
          <ChatWidget />
        </ChatSearchProvider>
      </BagProvider>
    </AuthProvider>
  );
}

export default App;
