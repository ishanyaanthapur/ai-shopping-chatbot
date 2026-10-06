// React Router doesn't reset scroll position on navigation by default, so
// without this, clicking a product card while scrolled down (e.g. past the
// persistent chat-search-results banner) leaves you scrolled to the same
// spot on the new page, making it look like the click did nothing.

import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return null;
}
