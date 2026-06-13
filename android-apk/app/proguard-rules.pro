-keep class com.google.androidbrowserhelper.** { *; }
-keep class androidx.browser.** { *; }

# Mantém a ponte JavaScript para a Câmera, Logout e Sincronização
-keepclassmembers class com.eunaman.pcm.EunamanActivity$EunamanJsBridge {
    @android.webkit.JavascriptInterface <methods>;
}

# Impede a ofuscação de classes necessárias para o WebView e Cookies
-keepclassmembers class * extends android.webkit.WebViewClient {
    public void *(android.webkit.WebView, java.lang.String);
    public boolean *(android.webkit.WebView, android.webkit.WebResourceRequest);
}
