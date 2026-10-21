// src/screens/WikipediaScreen.tsx

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { WebView } from "react-native-webview";

import type {
  NativeStackScreenProps,
} from "@react-navigation/native-stack";

import type {
  RootStackParamList,
} from "../navigation/types";

import {
  loadOfflineWikipediaArticle,
  saveOfflineWikipediaArticle,
  type OfflineWikipediaArticle,
} from "../services/infoDatabase";

import {
  downloadWikipediaArticle,
  parseWikipediaUrl,
} from "../services/offlineWikipedia";

type Props = NativeStackScreenProps<
  RootStackParamList,
  "Wikipedia"
>;

type DisplayMode = "online" | "offline";

function formatSavedDate(value: string): string {
  const date = new Date(value);

  if (!Number.isFinite(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-GB");
}

export default function WikipediaScreen({
  route,
}: Props) {
  const { url } = route.params;

  const [mode, setMode] =
    useState<DisplayMode>("online");

  const [article, setArticle] =
    useState<OfflineWikipediaArticle | null>(null);

  const [articleUrl, setArticleUrl] =
    useState<string | null>(null);

  const [checkingOfflineCopy, setCheckingOfflineCopy] =
    useState(true);

  const [availableOffline, setAvailableOffline] =
    useState(false);

  const [offlineNotice, setOfflineNotice] =
    useState<string | null>(null);

  const [webError, setWebError] =
    useState<string | null>(null);

  const [attempt, setAttempt] = useState(0);

  // Prepare the offline copy independently of the full online page.
  useEffect(() => {
    const controller = new AbortController();

    setMode("online");
    setArticle(null);
    setArticleUrl(null);
    setCheckingOfflineCopy(true);
    setAvailableOffline(false);
    setOfflineNotice(null);
    setWebError(null);

    async function prepareOfflineCopy():
      Promise<void> {
      let canonicalUrl: string;

      try {
        canonicalUrl =
          parseWikipediaUrl(url).sourceUrl;
      } catch {
        if (controller.signal.aborted) return;

        setOfflineNotice(
          "Offline saving is not supported for this link.",
        );

        setCheckingOfflineCopy(false);
        return;
      }

      try {
        const cached =
          await loadOfflineWikipediaArticle(
            canonicalUrl,
          );

        if (controller.signal.aborted) return;

        if (cached) {
          setArticle(cached);
          setArticleUrl(url);
          setAvailableOffline(true);
        }
      } catch {
        if (controller.signal.aborted) return;

        setOfflineNotice(
          "Saved article storage is temporarily unavailable.",
        );
      }

      try {
        const downloaded =
          await downloadWikipediaArticle(
            canonicalUrl,
            controller.signal,
          );

        if (controller.signal.aborted) return;

        // Keep the downloaded reading copy available in memory.
        // Persistent availability is confirmed after saving.
        setArticle(downloaded);
        setArticleUrl(url);
        setAvailableOffline(false);

        try {
          await saveOfflineWikipediaArticle(
            downloaded,
          );

          if (controller.signal.aborted) return;

          setAvailableOffline(true);
          setOfflineNotice(null);
        } catch {
          if (controller.signal.aborted) return;

          setOfflineNotice(
            "The reading copy was downloaded, but the new " +
              "copy could not be saved for offline use.",
          );
        }
      } catch (cause) {
        if (controller.signal.aborted) return;

        // A failed background update must not replace
        // or hide a previously loaded offline copy.
        if (__DEV__) {
          console.log(
            "Wikipedia offline copy diagnostic:",
            cause instanceof Error
              ? cause.message
              : String(cause),
          );
        }
      } finally {
        if (!controller.signal.aborted) {
          setCheckingOfflineCopy(false);
        }
      }
    }

    void prepareOfflineCopy();

    return () => {
      controller.abort();
    };
  }, [url, attempt]);

  const displayedArticle =
    articleUrl === url ? article : null;

  const offlineSource = useMemo(
    () => ({
      html: displayedArticle?.html ?? "",
    }),
    [displayedArticle?.html],
  );

  function handleOnlineFailure() {
    setWebError(
      "We couldn't load the full online page.",
    );

    setMode("offline");
  }

  function retryOnline() {
    setWebError(null);
    setMode("online");
    setAttempt((value) => value + 1);
  }

  function showOfflineCopy() {
    if (!displayedArticle) return;

    setWebError(null);
    setMode("offline");
  }

  function renderOnlinePage() {
    return (
      <WebView
        key={`online:${url}:${attempt}`}
        source={{ uri: url }}
        style={styles.webview}
        startInLoadingState
        javaScriptEnabled
        domStorageEnabled
        renderLoading={() => (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" />

            <Text style={styles.loadingText}>
              Loading full Wikipedia page…
            </Text>
          </View>
        )}
        onError={handleOnlineFailure}
        onHttpError={({ nativeEvent }) => {
          // Do not replace the page because a separate
          // image or other resource returned an HTTP error.
          if (
            nativeEvent.url === url &&
            nativeEvent.statusCode >= 400
          ) {
            handleOnlineFailure();
          }
        }}
      />
    );
  }

  function renderOfflinePage() {
    if (displayedArticle) {
      return (
        <WebView
          key={`offline:${displayedArticle.sourceUrl}`}
          source={offlineSource}
          style={styles.webview}
          originWhitelist={["*"]}
          javaScriptEnabled={false}
          domStorageEnabled={false}
          mixedContentMode="never"
          setSupportMultipleWindows={false}
          onShouldStartLoadWithRequest={(request) => {
            return (
              request.url === "about:blank" ||
              request.url.startsWith("about:blank#")
            );
          }}
          onError={() =>
            setOfflineNotice(
              "The saved article could not be displayed. " +
                "Try opening the online version when connected.",
            )
          }
        />
      );
    }

    if (checkingOfflineCopy) {
      return (
        <View style={styles.center}>
          <ActivityIndicator size="large" />

          <Text style={styles.loadingText}>
            Checking for an available reading copy…
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>
          Article unavailable offline
        </Text>

        <Text style={styles.emptyText}>
          This article has not been saved yet.
          Connect to the internet and open it
          to prepare an offline copy.
        </Text>

        <Pressable
          accessibilityRole="button"
          onPress={retryOnline}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>
            Try online again
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.toolbar}>
        <View style={styles.toolbarText}>
          <Text style={styles.modeTitle}>
            {mode === "online"
              ? "Full online page"
              : "Reading copy"}
          </Text>

          <Text style={styles.statusText}>
            {availableOffline
              ? "Text copy available offline"
              : checkingOfflineCopy
                ? "Preparing offline text copy…"
                : "Offline text copy not saved"}
          </Text>
        </View>

        {mode === "online" ? (
          <Pressable
            accessibilityRole="button"
            disabled={!displayedArticle}
            onPress={showOfflineCopy}
            style={({ pressed }) => [
              styles.toolbarButton,
              !displayedArticle && styles.disabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.toolbarButtonText}>
              Reading copy
            </Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            onPress={retryOnline}
            style={({ pressed }) => [
              styles.toolbarButton,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.toolbarButtonText}>
              Go online
            </Text>
          </Pressable>
        )}
      </View>

      {mode === "offline" && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>
            {webError
              ? `${webError} ${
                  displayedArticle
                    ? "Showing an available reading copy."
                    : "Checking for an offline copy."
                }`
              : "Reading copy: simplified formatting, without images."}
          </Text>

          {displayedArticle && (
            <Text style={styles.savedDate}>
              Copy retrieved:{" "}
              {formatSavedDate(
                displayedArticle.savedAt,
              )}
            </Text>
          )}
        </View>
      )}

      {offlineNotice && (
        <View style={styles.storageNotice}>
          <Text style={styles.noticeText}>
            {offlineNotice}
          </Text>
        </View>
      )}

      <View style={styles.pageContainer}>
        {mode === "online"
          ? renderOnlinePage()
          : renderOfflinePage()}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  pageContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    backgroundColor: "#fff",
  },
  toolbarText: {
    flex: 1,
    marginRight: 12,
  },
  modeTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#0f172a",
  },
  statusText: {
    marginTop: 4,
    fontSize: 12,
    color: "#64748b",
  },
  toolbarButton: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: "#eff6ff",
  },
  toolbarButtonText: {
    color: "#1d4ed8",
    fontSize: 13,
    fontWeight: "600",
  },
  notice: {
    padding: 12,
    backgroundColor: "#f1f5f9",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  storageNotice: {
    padding: 12,
    backgroundColor: "#fff7ed",
  },
  noticeText: {
    color: "#475569",
    fontSize: 13,
    lineHeight: 20,
  },
  savedDate: {
    marginTop: 5,
    color: "#64748b",
    fontSize: 12,
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  loadingText: {
    marginTop: 12,
    color: "#64748b",
    textAlign: "center",
  },
  center: {
    flex: 1,
    padding: 24,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 19,
    fontWeight: "600",
    color: "#0f172a",
    textAlign: "center",
    marginBottom: 10,
  },
  emptyText: {
    color: "#475569",
    lineHeight: 22,
    textAlign: "center",
    marginBottom: 20,
  },
  primaryButton: {
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 10,
    backgroundColor: "#2563eb",
  },
  primaryButtonText: {
    color: "#fff",
    fontWeight: "600",
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.7,
  },
});