package expo.modules.dmzmigration

import android.app.Activity
import android.app.AlertDialog
import android.content.Context
import android.graphics.Color
import android.graphics.Bitmap
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Message
import android.text.InputFilter
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.GeolocationPermissions
import android.webkit.JsPromptResult
import android.webkit.JsResult
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import com.facebook.react.uimanager.UIManagerHelper
import java.util.WeakHashMap

/**
 * Restores the Java client's WebChromeClient behavior on top of react-native-webview.
 *
 * react-native-webview owns the primary WebChromeClient, so this class wraps it instead
 * of replacing its file chooser/progress/permission behavior. Only JavaScript-owned
 * dialogs are intercepted and rendered with the same DMZ Ranked modal treatment used
 * by the original Java MainActivity.
 */
internal object DmzWebChromeParity {
  private val clients = WeakHashMap<WebView, DmzDelegatingChromeClient>()

  fun install(
    context: com.facebook.react.bridge.ReactContext,
    reactTag: Int,
    animations: Boolean,
    contentScale: Double
  ): Boolean {
    val uiManager = UIManagerHelper.getUIManagerForReactTag(context, reactTag) ?: return false
    val root = try {
      uiManager.resolveView(reactTag)
    } catch (_: Throwable) {
      null
    } ?: return false

    val webView = findWebView(root) ?: return false

    // Match MainActivity.configureWebView() where react-native-webview's
    // defaults differ from the original Java client.
    webView.settings.apply {
      loadsImagesAutomatically = true
      javaScriptEnabled = true
      domStorageEnabled = true
      javaScriptCanOpenWindowsAutomatically = false
      setSupportMultipleWindows(false)
      allowFileAccess = false
      allowContentAccess = true
      builtInZoomControls = false
    }

    val existing = clients[webView]
    if (existing != null && webView.webChromeClient === existing) {
      existing.updatePreferences(animations, contentScale.toFloat())
      return true
    }

    val delegate = webView.webChromeClient ?: WebChromeClient()
    val wrapped = DmzDelegatingChromeClient(
      delegate = delegate,
      animations = animations,
      contentScale = contentScale.toFloat()
    )
    webView.webChromeClient = wrapped
    clients[webView] = wrapped
    return true
  }

  private fun findWebView(view: View): WebView? {
    if (view is WebView) return view
    if (view is ViewGroup) {
      for (index in 0 until view.childCount) {
        val found = findWebView(view.getChildAt(index))
        if (found != null) return found
      }
    }
    return null
  }
}

private class DmzDelegatingChromeClient(
  private val delegate: WebChromeClient,
  animations: Boolean,
  contentScale: Float
) : WebChromeClient() {
  private var animationsEnabled = animations
  private var scale = contentScale.coerceIn(0.75f, 1.25f)

  fun updatePreferences(animations: Boolean, contentScale: Float) {
    animationsEnabled = animations
    scale = contentScale.coerceIn(0.75f, 1.25f)
  }

  private fun activity(view: WebView): Activity? {
    var current: Context? = view.context
    while (current != null) {
      if (current is Activity) return current
      current = if (current is android.content.ContextWrapper) current.baseContext else null
    }
    return null
  }

  override fun onJsAlert(view: WebView, url: String?, message: String?, result: JsResult): Boolean {
    val host = activity(view) ?: return delegate.onJsAlert(view, url, message, result)
    DmzBrowserDialog.confirm(
      host,
      eyebrow = "DMZ RANKED",
      title = "WEBSITE ALERT",
      message = message.orEmpty(),
      positiveLabel = "OK",
      negativeLabel = null,
      animations = animationsEnabled,
      scale = scale,
      onPositive = result::confirm,
      onNegative = result::cancel
    )
    return true
  }

  override fun onJsConfirm(view: WebView, url: String?, message: String?, result: JsResult): Boolean {
    val host = activity(view) ?: return delegate.onJsConfirm(view, url, message, result)
    DmzBrowserDialog.confirm(
      host,
      eyebrow = "DMZ RANKED",
      title = "WEBSITE CONFIRMATION",
      message = message.orEmpty(),
      positiveLabel = "CONFIRM",
      negativeLabel = "CANCEL",
      animations = animationsEnabled,
      scale = scale,
      onPositive = result::confirm,
      onNegative = result::cancel
    )
    return true
  }

  override fun onJsPrompt(
    view: WebView,
    url: String?,
    message: String?,
    defaultValue: String?,
    result: JsPromptResult
  ): Boolean {
    val host = activity(view) ?: return delegate.onJsPrompt(view, url, message, defaultValue, result)
    DmzBrowserDialog.input(
      host,
      title = "WEBSITE INPUT",
      message = message.orEmpty(),
      defaultValue = defaultValue.orEmpty(),
      animations = animationsEnabled,
      scale = scale,
      onPositive = result::confirm,
      onNegative = result::cancel
    )
    return true
  }

  override fun onJsBeforeUnload(view: WebView, url: String?, message: String?, result: JsResult): Boolean {
    val host = activity(view) ?: return delegate.onJsBeforeUnload(view, url, message, result)
    DmzBrowserDialog.confirm(
      host,
      eyebrow = "DMZ RANKED",
      title = "LEAVE THIS PAGE?",
      message = message.orEmpty(),
      positiveLabel = "LEAVE",
      negativeLabel = "STAY",
      animations = animationsEnabled,
      scale = scale,
      onPositive = result::confirm,
      onNegative = result::cancel
    )
    return true
  }

  // Preserve react-native-webview behavior that its RNCWebChromeClient owns.
  override fun onProgressChanged(view: WebView, newProgress: Int) =
    delegate.onProgressChanged(view, newProgress)

  override fun onShowFileChooser(
    webView: WebView,
    filePathCallback: ValueCallback<Array<Uri>>,
    fileChooserParams: FileChooserParams
  ): Boolean {
    val handled = delegate.onShowFileChooser(
      webView,
      filePathCallback,
      fileChooserParams
    )
    if (!handled) {
      Toast.makeText(
        webView.context,
        "No file picker is available.",
        Toast.LENGTH_SHORT
      ).show()
    }
    return handled
  }

  override fun onCreateWindow(
    view: WebView,
    isDialog: Boolean,
    isUserGesture: Boolean,
    resultMsg: Message
  ): Boolean = delegate.onCreateWindow(view, isDialog, isUserGesture, resultMsg)

  override fun onCloseWindow(window: WebView) = delegate.onCloseWindow(window)
  override fun onRequestFocus(view: WebView) = delegate.onRequestFocus(view)
  override fun onPermissionRequest(request: PermissionRequest) = delegate.onPermissionRequest(request)
  override fun onPermissionRequestCanceled(request: PermissionRequest) =
    delegate.onPermissionRequestCanceled(request)

  override fun onGeolocationPermissionsShowPrompt(
    origin: String,
    callback: GeolocationPermissions.Callback
  ) = delegate.onGeolocationPermissionsShowPrompt(origin, callback)

  override fun onGeolocationPermissionsHidePrompt() =
    delegate.onGeolocationPermissionsHidePrompt()

  override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean =
    delegate.onConsoleMessage(consoleMessage)

  override fun onReceivedTitle(view: WebView, title: String?) =
    delegate.onReceivedTitle(view, title)

  override fun onReceivedIcon(view: WebView, icon: Bitmap?) =
    delegate.onReceivedIcon(view, icon)

  override fun onReceivedTouchIconUrl(view: WebView, url: String?, precomposed: Boolean) =
    delegate.onReceivedTouchIconUrl(view, url, precomposed)

  override fun getDefaultVideoPoster(): Bitmap? = delegate.defaultVideoPoster
  override fun getVideoLoadingProgressView(): View? = delegate.videoLoadingProgressView

  override fun onShowCustomView(view: View, callback: CustomViewCallback) =
    delegate.onShowCustomView(view, callback)

  override fun onShowCustomView(
    view: View,
    requestedOrientation: Int,
    callback: CustomViewCallback
  ) = delegate.onShowCustomView(view, requestedOrientation, callback)

  override fun onHideCustomView() = delegate.onHideCustomView()

  override fun getVisitedHistory(callback: ValueCallback<Array<String>>) =
    delegate.getVisitedHistory(callback)
}

private object DmzBrowserDialog {
  private const val BLACK = "#080A09"
  private const val GOLD = "#F6C453"
  private const val GOLD_DARK = "#D8A433"
  private const val WHITE = "#F5F5F5"
  private const val MUTED = "#999F9B"
  private const val PANEL_DEEP = "#0B0F11"
  private const val CARD = "#121619"
  private const val CARD_BORDER_GOLD = "#8A6B24"

  fun confirm(
    activity: Activity,
    eyebrow: String,
    title: String,
    message: String,
    positiveLabel: String,
    negativeLabel: String?,
    animations: Boolean,
    scale: Float,
    onPositive: () -> Unit,
    onNegative: () -> Unit
  ) {
    val safeScale = scale.coerceIn(0.75f, 1.25f)
    val card = buildCard(activity, eyebrow, title, message, safeScale)
    val row = LinearLayout(activity).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }

    var negative: TextView? = null
    if (!negativeLabel.isNullOrBlank()) {
      negative = action(activity, negativeLabel, false, safeScale)
      row.addView(negative, weighted(activity, safeScale, false))
    }

    val positive = action(activity, positiveLabel, true, safeScale)
    row.addView(positive, weighted(activity, safeScale, negative != null))
    card.addView(
      row,
      LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply { topMargin = dp(activity, 18, safeScale) }
    )

    var resolved = false
    val dialog = present(activity, card, animations, safeScale, false)
    negative?.setOnClickListener {
      if (!resolved) {
        resolved = true
        dialog.dismiss()
        onNegative()
      }
    }
    positive.setOnClickListener {
      if (!resolved) {
        resolved = true
        dialog.dismiss()
        onPositive()
      }
    }
    dialog.setOnCancelListener {
      if (!resolved) {
        resolved = true
        onNegative()
      }
    }
  }

  fun input(
    activity: Activity,
    title: String,
    message: String,
    defaultValue: String,
    animations: Boolean,
    scale: Float,
    onPositive: (String) -> Unit,
    onNegative: () -> Unit
  ) {
    val safeScale = scale.coerceIn(0.75f, 1.25f)
    val card = buildCard(activity, "DMZ RANKED", title, message, safeScale)
    val input = EditText(activity).apply {
      setSingleLine(true)
      hint = "Enter value"
      setText(defaultValue)
      inputType = InputType.TYPE_CLASS_TEXT
      filters = arrayOf(InputFilter.LengthFilter(256))
      setTextColor(color(WHITE))
      setHintTextColor(color(MUTED))
      backgroundTintList = android.content.res.ColorStateList.valueOf(color(GOLD))
      setPadding(
        dp(activity, 10, safeScale),
        dp(activity, 9, safeScale),
        dp(activity, 10, safeScale),
        dp(activity, 9, safeScale)
      )
      textSize = sp(15f, safeScale)
    }
    card.addView(
      input,
      LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply { topMargin = dp(activity, 14, safeScale) }
    )

    val row = LinearLayout(activity).apply {
      orientation = LinearLayout.HORIZONTAL
      gravity = Gravity.CENTER_VERTICAL
    }
    val negative = action(activity, "CANCEL", false, safeScale)
    val positive = action(activity, "SUBMIT", true, safeScale)
    row.addView(negative, weighted(activity, safeScale, false))
    row.addView(positive, weighted(activity, safeScale, true))
    card.addView(
      row,
      LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply { topMargin = dp(activity, 18, safeScale) }
    )

    var resolved = false
    val dialog = present(activity, card, animations, safeScale, true)
    negative.setOnClickListener {
      if (!resolved) {
        resolved = true
        dialog.dismiss()
        onNegative()
      }
    }
    positive.setOnClickListener {
      if (!resolved) {
        resolved = true
        val value = input.text?.toString().orEmpty()
        dialog.dismiss()
        onPositive(value)
      }
    }
    dialog.setOnCancelListener {
      if (!resolved) {
        resolved = true
        onNegative()
      }
    }
    input.requestFocus()
    input.setSelection(input.text?.length ?: 0)
  }

  private fun buildCard(
    activity: Activity,
    eyebrowText: String,
    title: String,
    message: String,
    scale: Float
  ): LinearLayout {
    val card = LinearLayout(activity).apply {
      orientation = LinearLayout.VERTICAL
      setPadding(
        dp(activity, 18, scale),
        dp(activity, 18, scale),
        dp(activity, 18, scale),
        dp(activity, 16, scale)
      )
      background = GradientDrawable(
        GradientDrawable.Orientation.TOP_BOTTOM,
        intArrayOf(color("#171C20"), color(CARD), color(PANEL_DEEP))
      ).apply {
        cornerRadius = dp(activity, 16, scale).toFloat()
        setStroke(dp(activity, 1, scale), color(CARD_BORDER_GOLD))
      }
    }

    card.addView(TextView(activity).apply {
      text = eyebrowText
      setTextColor(color(GOLD))
      textSize = sp(10.5f, scale)
      typeface = android.graphics.Typeface.DEFAULT_BOLD
      letterSpacing = 0.15f
    })

    card.addView(
      TextView(activity).apply {
        text = title
        setTextColor(color(WHITE))
        textSize = sp(21f, scale)
        typeface = android.graphics.Typeface.create("sans-serif-condensed", android.graphics.Typeface.BOLD)
      },
      LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT
      ).apply { topMargin = dp(activity, 7, scale) }
    )

    if (message.isNotBlank()) {
      card.addView(
        TextView(activity).apply {
          text = message
          setTextColor(color(MUTED))
          textSize = sp(13.5f, scale)
          setLineSpacing(0f, 1.12f)
        },
        LinearLayout.LayoutParams(
          LinearLayout.LayoutParams.MATCH_PARENT,
          LinearLayout.LayoutParams.WRAP_CONTENT
        ).apply { topMargin = dp(activity, 9, scale) }
      )
    }
    return card
  }

  private fun action(
    activity: Activity,
    label: String,
    primary: Boolean,
    scale: Float
  ): TextView = TextView(activity).apply {
    text = label
    gravity = Gravity.CENTER
    textSize = sp(11f, scale)
    typeface = android.graphics.Typeface.DEFAULT_BOLD
    letterSpacing = 0.05f
    isClickable = true
    isFocusable = true
    minHeight = dp(activity, 48, scale)
    setPadding(
      dp(activity, 12, scale),
      dp(activity, 12, scale),
      dp(activity, 12, scale),
      dp(activity, 12, scale)
    )
    setTextColor(color(if (primary) BLACK else MUTED))
    background = GradientDrawable().apply {
      cornerRadius = dp(activity, 10, scale).toFloat()
      setColor(color(if (primary) GOLD else PANEL_DEEP))
      setStroke(
        dp(activity, 1, scale),
        color(if (primary) GOLD else "#343A3B")
      )
    }
  }

  private fun weighted(activity: Activity, scale: Float, withLeftMargin: Boolean) =
    LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f).apply {
      if (withLeftMargin) leftMargin = dp(activity, 10, scale)
    }

  private fun present(
    activity: Activity,
    card: View,
    animations: Boolean,
    scale: Float,
    showKeyboard: Boolean
  ): AlertDialog {
    val dialog = AlertDialog.Builder(activity).setView(card).create()
    dialog.setOnShowListener {
      dialog.window?.let { window ->
        window.setBackgroundDrawableResource(android.R.color.transparent)
        val width = minOf(
          activity.resources.displayMetrics.widthPixels - dp(activity, 28, 1f),
          dp(activity, 450, scale)
        )
        window.setLayout(width, ViewGroup.LayoutParams.WRAP_CONTENT)
        window.addFlags(WindowManager.LayoutParams.FLAG_DIM_BEHIND)
        window.attributes = window.attributes.apply { dimAmount = 0.78f }
        if (showKeyboard) {
          window.setSoftInputMode(
            WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE or
              WindowManager.LayoutParams.SOFT_INPUT_STATE_ALWAYS_VISIBLE
          )
        }
      }

      card.elevation = dp(activity, 18, scale).toFloat()
      if (animations) {
        card.alpha = 0f
        card.scaleX = 0.97f
        card.scaleY = 0.97f
        card.translationY = dp(activity, 10, scale).toFloat()
        card.animate()
          .alpha(1f)
          .scaleX(1f)
          .scaleY(1f)
          .translationY(0f)
          .setDuration(190L)
          .start()
      }
    }
    dialog.show()
    return dialog
  }

  private fun dp(activity: Activity, value: Int, scale: Float): Int =
    (value * activity.resources.displayMetrics.density * scale).toInt().coerceAtLeast(1)

  private fun sp(value: Float, scale: Float): Float = value * scale
  private fun color(hex: String): Int = Color.parseColor(hex)
}
