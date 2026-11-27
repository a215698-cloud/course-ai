package com.kairo.secretary

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Inbox
import androidx.compose.material.icons.filled.Shield
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.core.content.ContextCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.viewmodel.compose.viewModel
import com.kairo.secretary.notifications.DeadlineNotifier
import com.kairo.secretary.ui.CaptureMessageDialog
import com.kairo.secretary.ui.ChatScreen
import com.kairo.secretary.ui.InboxScreen
import com.kairo.secretary.ui.MemoryPrivacyScreen
import com.kairo.secretary.ui.OverviewScreen
import com.kairo.secretary.ui.SecretaryViewModel
import com.kairo.secretary.ui.TasksScreen
import com.kairo.secretary.ui.stringsFor
import com.kairo.secretary.ui.theme.KairoSecretaryTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        DeadlineNotifier.ensureChannel(this)
        setContent {
            KairoSecretaryTheme {
                KairoSecretaryApp()
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun KairoSecretaryApp(viewModel: SecretaryViewModel = viewModel()) {
    val uiState by viewModel.uiState.collectAsState()
    val strings = stringsFor(uiState.language)
    val snackbarHostState = remember { SnackbarHostState() }
    var selectedTab by remember { mutableIntStateOf(0) }
    var showCaptureDialog by remember { mutableStateOf(false) }

    val context = LocalContext.current
    val lifecycleOwner = LocalLifecycleOwner.current

    // Refresh NotificationListener permission & sync workspace when returning from Android Settings
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                viewModel.onAppResumed()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
    }

    // Request POST_NOTIFICATIONS permission on Android 13+
    val notifPermissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { }

    LaunchedEffect(Unit) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                context,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) {
                notifPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    LaunchedEffect(uiState.statusBanner, uiState.errorMessage) {
        val msg = uiState.errorMessage ?: uiState.statusBanner
        if (msg != null) {
            snackbarHostState.showSnackbar(msg)
            viewModel.clearBanner()
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text(strings.appTitle, fontWeight = FontWeight.Bold)
                },
                actions = {
                    Row {
                        listOf("en" to "EN", "zh" to "中文", "ms" to "BM").forEach { (code, label) ->
                            TextButton(onClick = { viewModel.setLanguage(code) }) {
                                Text(
                                    text = label,
                                    fontWeight = if (uiState.language == code) FontWeight.Bold else FontWeight.Normal
                                )
                            }
                        }
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbarHostState) },
        floatingActionButton = {
            if (selectedTab != 3 && uiState.isAuthenticated) {
                FloatingActionButton(onClick = { showCaptureDialog = true }) {
                    Icon(Icons.Default.Add, contentDescription = strings.captureBtn)
                }
            }
        },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    icon = { Icon(Icons.Default.Dashboard, contentDescription = null) },
                    label = { Text(strings.navOverview) }
                )
                NavigationBarItem(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    icon = { Icon(Icons.Default.Inbox, contentDescription = null) },
                    label = { Text(strings.navInbox) }
                )
                NavigationBarItem(
                    selected = selectedTab == 2,
                    onClick = { selectedTab = 2 },
                    icon = { Icon(Icons.Default.CheckCircle, contentDescription = null) },
                    label = { Text(strings.navTasks) }
                )
                NavigationBarItem(
                    selected = selectedTab == 3,
                    onClick = { selectedTab = 3 },
                    icon = { Icon(Icons.Default.Chat, contentDescription = null) },
                    label = { Text(strings.navChat) }
                )
                NavigationBarItem(
                    selected = selectedTab == 4,
                    onClick = { selectedTab = 4 },
                    icon = { Icon(Icons.Default.Shield, contentDescription = null) },
                    label = { Text(strings.navPrivacy) }
                )
            }
        }
    ) { innerPadding ->
        Box(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            if (uiState.isLoading) {
                CircularProgressIndicator(modifier = Modifier.align(Alignment.Center))
            } else {
                when (selectedTab) {
                    0 -> OverviewScreen(
                        uiState = uiState,
                        strings = strings,
                        viewModel = viewModel,
                        onOpenTasks = { selectedTab = 2 },
                        onOpenInbox = { selectedTab = 1 },
                        onOpenPrivacy = { selectedTab = 4 }
                    )
                    1 -> InboxScreen(
                        uiState = uiState,
                        strings = strings,
                        viewModel = viewModel,
                        onOpenPrivacy = { selectedTab = 4 }
                    )
                    2 -> TasksScreen(uiState = uiState, strings = strings, viewModel = viewModel)
                    3 -> ChatScreen(
                        uiState = uiState,
                        strings = strings,
                        viewModel = viewModel,
                        onOpenPrivacy = { selectedTab = 4 }
                    )
                    4 -> MemoryPrivacyScreen(uiState = uiState, strings = strings, viewModel = viewModel)
                }
            }
        }
    }

    if (showCaptureDialog) {
        CaptureMessageDialog(
            strings = strings,
            onDismiss = { showCaptureDialog = false },
            onSubmit = { src, sender, title, raw ->
                viewModel.ingestManualMessage(src, sender, title, raw)
                showCaptureDialog = false
            }
        )
    }
}
