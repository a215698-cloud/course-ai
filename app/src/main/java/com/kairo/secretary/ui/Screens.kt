package com.kairo.secretary.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.ContentPaste
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material.icons.filled.KeyboardArrowUp
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.kairo.secretary.data.ChannelStats
import com.kairo.secretary.data.ConnectionErrorType
import com.kairo.secretary.data.IngestedMessage
import com.kairo.secretary.data.SecretaryTask
import com.kairo.secretary.notifications.DeadlineNotifier

@Composable
private fun ConnectionOrAuthBanner(
    uiState: MainUiState,
    strings: UiStrings,
    viewModel: SecretaryViewModel,
    onOpenPrivacy: () -> Unit
) {
    if (uiState.backendUrl.isBlank()) {
        SurfaceCard(modifier = Modifier.clickable { onOpenPrivacy() }) {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(Icons.Default.Warning, contentDescription = null, tint = MaterialTheme.colorScheme.error)
                Text(
                    text = strings.backendMissingBanner,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error
                )
            }
        }
    } else if (!uiState.isAuthenticated) {
        PasscodeUnlockCard(uiState = uiState, strings = strings, viewModel = viewModel)
    }
}

@Composable
fun PasscodeUnlockCard(
    uiState: MainUiState,
    strings: UiStrings,
    viewModel: SecretaryViewModel
) {
    var passcode by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }
    val isClaim = !uiState.authClaimed

    SurfaceCard {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            Icon(Icons.Default.Lock, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            Text(
                text = if (isClaim) strings.authClaimTitle else strings.authLoginTitle,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold
            )
        }
        Spacer(Modifier.height(6.dp))
        Text(
            text = if (isClaim) strings.authClaimDesc else strings.authLoginDesc,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Spacer(Modifier.height(10.dp))
        OutlinedTextField(
            value = passcode,
            onValueChange = { passcode = it },
            placeholder = { Text(strings.passcodePlaceholder) },
            visualTransformation = PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
            singleLine = true,
            modifier = Modifier.fillMaxWidth()
        )
        if (isClaim) {
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = confirm,
                onValueChange = { confirm = it },
                placeholder = { Text(strings.confirmPasscodePlaceholder) },
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
        }
        Spacer(Modifier.height(10.dp))
        Button(
            onClick = {
                if (isClaim && passcode.trim() != confirm.trim()) {
                    return@Button
                }
                viewModel.submitPasscode(passcode, isClaim = isClaim)
            },
            enabled = !uiState.isBusy && passcode.trim().length >= 6 && (!isClaim || passcode.trim() == confirm.trim()),
            modifier = Modifier.fillMaxWidth()
        ) {
            Text(if (isClaim) strings.authClaimBtn else strings.authLoginBtn)
        }
    }
}

@Composable
fun OverviewScreen(
    uiState: MainUiState,
    strings: UiStrings,
    viewModel: SecretaryViewModel,
    onOpenTasks: () -> Unit,
    onOpenInbox: () -> Unit,
    onOpenPrivacy: () -> Unit
) {
    val state = uiState.secretaryState
    val openTasks = state.tasks.filter { it.status != "completed" }
    val importantMsgs = state.messages.filter { it.importance == "critical" || it.importance == "high" }
    val pendingChanges = state.scheduleChanges.filter { it.status == "pending" }
    val latestBriefing = state.briefings.firstOrNull()

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        if (uiState.backendUrl.isBlank() || !uiState.isAuthenticated) {
            item {
                ConnectionOrAuthBanner(
                    uiState = uiState,
                    strings = strings,
                    viewModel = viewModel,
                    onOpenPrivacy = onOpenPrivacy
                )
            }
        }

        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                MetricBox(
                    label = strings.tasks,
                    value = openTasks.size.toString(),
                    modifier = Modifier.weight(1f),
                    onClick = onOpenTasks
                )
                MetricBox(
                    label = strings.importantOnly,
                    value = importantMsgs.size.toString(),
                    modifier = Modifier.weight(1f),
                    onClick = onOpenInbox
                )
                MetricBox(
                    label = strings.scheduleChanges,
                    value = pendingChanges.size.toString(),
                    modifier = Modifier.weight(1f),
                    onClick = {}
                )
            }
        }

        // Daily Briefing Card
        item {
            SurfaceCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = strings.briefingTitle,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    Button(
                        onClick = { viewModel.generateBriefing() },
                        enabled = !uiState.isBusy && uiState.isAuthenticated,
                        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                    ) {
                        Icon(Icons.Default.AutoAwesome, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(strings.generateBriefing, style = MaterialTheme.typography.labelMedium)
                    }
                }
                Spacer(Modifier.height(10.dp))
                if (latestBriefing == null) {
                    Text(
                        text = strings.briefingEmpty,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    Text(
                        text = latestBriefing.headline,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold
                    )
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = latestBriefing.overview,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    if (latestBriefing.topPriorities.isNotEmpty()) {
                        Spacer(Modifier.height(10.dp))
                        latestBriefing.topPriorities.forEachIndexed { idx, priority ->
                            Text(
                                text = "${idx + 1}. $priority",
                                style = MaterialTheme.typography.bodySmall
                            )
                        }
                    }
                }
            }
        }

        // Cross-Message Schedule Changes
        item {
            SurfaceCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = strings.scheduleChanges,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold
                    )
                    OutlinedButton(
                        onClick = { viewModel.runCrossAnalysis() },
                        enabled = !uiState.isBusy && uiState.isAuthenticated,
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 6.dp)
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(15.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(strings.crossAnalyze, style = MaterialTheme.typography.labelMedium)
                    }
                }
                Spacer(Modifier.height(8.dp))
                if (pendingChanges.isEmpty()) {
                    Text(
                        text = strings.noScheduleChanges,
                        style = MaterialTheme.typography.bodyMedium,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    pendingChanges.forEach { change ->
                        Column(modifier = Modifier.padding(vertical = 8.dp)) {
                            Text(change.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                            Spacer(Modifier.height(4.dp))
                            Text(
                                text = change.summary,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant
                            )
                            Spacer(Modifier.height(4.dp))
                            Text(
                                text = "${change.previousValue} -> ${change.newValue}",
                                style = MaterialTheme.typography.labelMedium,
                                color = MaterialTheme.colorScheme.primary
                            )
                            Spacer(Modifier.height(8.dp))
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                Button(
                                    onClick = { viewModel.applyScheduleChange(change.id) },
                                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                                ) {
                                    Text(strings.applyUpdate, style = MaterialTheme.typography.labelMedium)
                                }
                                OutlinedButton(
                                    onClick = { viewModel.dismissScheduleChange(change.id) },
                                    contentPadding = PaddingValues(horizontal = 12.dp, vertical = 6.dp)
                                ) {
                                    Text(strings.dismiss, style = MaterialTheme.typography.labelMedium)
                                }
                            }
                            HorizontalDivider(modifier = Modifier.padding(top = 10.dp))
                        }
                    }
                }
            }
        }

        // Urgent Deadlines
        item {
            Text(
                text = strings.urgentDeadlines,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(top = 4.dp)
            )
        }

        items(openTasks.take(6), key = { it.id }) { task ->
            TaskRowCard(
                task = task,
                onToggle = { viewModel.toggleTaskStatus(task.id, true) },
                onDelete = { viewModel.deleteTask(task.id) },
                addToCalendarLabel = strings.addToCalendar
            )
        }
    }
}

@Composable
fun InboxScreen(
    uiState: MainUiState,
    strings: UiStrings,
    viewModel: SecretaryViewModel,
    onOpenPrivacy: () -> Unit
) {
    var filter by remember { mutableStateOf("all") }
    var search by remember { mutableStateOf("") }
    var selectedMessage by remember { mutableStateOf<IngestedMessage?>(null) }

    val messages = uiState.secretaryState.messages.filter { m ->
        when (filter) {
            "important" -> m.importance == "critical" || m.importance == "high"
            "unread" -> !m.read
            else -> true
        } && (search.isBlank() ||
            m.sender.contains(search, ignoreCase = true) ||
            m.summary.contains(search, ignoreCase = true) ||
            m.redactedText.contains(search, ignoreCase = true))
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            if (uiState.backendUrl.isBlank() || !uiState.isAuthenticated) {
                ConnectionOrAuthBanner(
                    uiState = uiState,
                    strings = strings,
                    viewModel = viewModel,
                    onOpenPrivacy = onOpenPrivacy
                )
            }
            OutlinedTextField(
                value = search,
                onValueChange = { search = it },
                placeholder = { Text("Search sender or summary...") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth()
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState()),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically
            ) {
                FilterChip(
                    selected = filter == "all",
                    onClick = { filter = "all" },
                    label = { Text(strings.all) }
                )
                FilterChip(
                    selected = filter == "important",
                    onClick = { filter = "important" },
                    label = { Text(strings.importantOnly) }
                )
                FilterChip(
                    selected = filter == "unread",
                    onClick = { filter = "unread" },
                    label = { Text(strings.unread) }
                )
                OutlinedButton(
                    onClick = { viewModel.loadSamples() },
                    enabled = !uiState.isBusy && uiState.isAuthenticated
                ) {
                    Text(strings.loadSamples)
                }
                IconButton(
                    onClick = { viewModel.refreshState() },
                    enabled = !uiState.isBusy && uiState.isAuthenticated
                ) {
                    Icon(Icons.Default.Refresh, contentDescription = "Refresh")
                }
            }
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(messages, key = { it.id }) { msg ->
                SurfaceCard(
                    modifier = Modifier.clickable {
                        selectedMessage = msg
                        if (!msg.read) viewModel.markMessageRead(msg.id, true)
                    }
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "${msg.importance.uppercase()} · ${msg.source.uppercase()} · ${msg.detectedLanguages.joinToString("/")}",
                            style = MaterialTheme.typography.labelSmall,
                            color = if (msg.importance == "critical") MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant
                        )
                        IconButton(
                            onClick = { viewModel.deleteMessage(msg.id) },
                            modifier = Modifier.size(24.dp)
                        ) {
                            Icon(Icons.Default.Delete, contentDescription = "Delete", modifier = Modifier.size(16.dp))
                        }
                    }
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = msg.sender + (msg.chatTitle?.let { " · $it" } ?: ""),
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = if (msg.read) FontWeight.Medium else FontWeight.Bold
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = msg.summary,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 3,
                        overflow = TextOverflow.Ellipsis
                    )
                }
            }
        }
    }

    selectedMessage?.let { msg ->
        AlertDialog(
            onDismissRequest = { selectedMessage = null },
            title = { Text(msg.sender) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        text = "${msg.source.uppercase()} · ${msg.importance.uppercase()}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Text(msg.summary, style = MaterialTheme.typography.bodyMedium)
                    if (msg.entities.dates.isNotEmpty() || msg.entities.locations.isNotEmpty()) {
                        HorizontalDivider()
                        if (msg.entities.dates.isNotEmpty()) {
                            Text("Dates: ${msg.entities.dates.joinToString(", ")}", style = MaterialTheme.typography.bodySmall)
                        }
                        if (msg.entities.times.isNotEmpty()) {
                            Text("Times: ${msg.entities.times.joinToString(", ")}", style = MaterialTheme.typography.bodySmall)
                        }
                        if (msg.entities.locations.isNotEmpty()) {
                            Text("Locations: ${msg.entities.locations.joinToString(", ")}", style = MaterialTheme.typography.bodySmall)
                        }
                    }
                    HorizontalDivider()
                    Text(
                        text = msg.redactedText,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = { selectedMessage = null }) {
                    Text("Close")
                }
            }
        )
    }
}

@Composable
fun TasksScreen(
    uiState: MainUiState,
    strings: UiStrings,
    viewModel: SecretaryViewModel
) {
    var category by remember { mutableStateOf("all") }
    var showCompleted by remember { mutableStateOf(false) }
    var showAddDialog by remember { mutableStateOf(false) }

    val filtered = uiState.secretaryState.tasks.filter { task ->
        (if (showCompleted) task.status == "completed" else task.status != "completed") &&
            (category == "all" || task.category == category)
    }

    Column(modifier = Modifier.fillMaxSize()) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 10.dp)
                .horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            FilterChip(selected = !showCompleted, onClick = { showCompleted = false }, label = { Text(strings.open) })
            FilterChip(selected = showCompleted, onClick = { showCompleted = true }, label = { Text(strings.completed) })
            FilterChip(selected = category == "all", onClick = { category = "all" }, label = { Text(strings.all) })
            FilterChip(selected = category == "assignment", onClick = { category = "assignment" }, label = { Text(strings.assignments) })
            FilterChip(selected = category == "meeting", onClick = { category = "meeting" }, label = { Text(strings.meetings) })
            FilterChip(selected = category == "task", onClick = { category = "task" }, label = { Text(strings.tasks) })
            Button(
                onClick = { showAddDialog = true },
                enabled = uiState.isAuthenticated
            ) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text(strings.addTask)
            }
        }

        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            items(filtered, key = { it.id }) { task ->
                TaskRowCard(
                    task = task,
                    onToggle = { viewModel.toggleTaskStatus(task.id, task.status != "completed") },
                    onDelete = { viewModel.deleteTask(task.id) },
                    addToCalendarLabel = strings.addToCalendar
                )
            }
        }
    }

    if (showAddDialog) {
        AddTaskDialog(
            strings = strings,
            onDismiss = { showAddDialog = false },
            onSave = { title, desc, cat, date, time, loc ->
                viewModel.createTask(title, desc, cat, "high", date, time, loc)
                showAddDialog = false
            }
        )
    }
}

@Composable
fun ChatScreen(
    uiState: MainUiState,
    strings: UiStrings,
    viewModel: SecretaryViewModel,
    onOpenPrivacy: () -> Unit
) {
    var input by remember { mutableStateOf("") }
    val history = uiState.secretaryState.chatHistory

    Column(modifier = Modifier.fillMaxSize()) {
        if (uiState.backendUrl.isBlank() || !uiState.isAuthenticated) {
            Box(modifier = Modifier.padding(16.dp)) {
                ConnectionOrAuthBanner(
                    uiState = uiState,
                    strings = strings,
                    viewModel = viewModel,
                    onOpenPrivacy = onOpenPrivacy
                )
            }
        }

        if (history.isNotEmpty()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.End
            ) {
                TextButton(
                    onClick = { viewModel.clearChat() },
                    enabled = !uiState.isBusy && uiState.isAuthenticated
                ) {
                    Text(strings.clearChat)
                }
            }
        }

        LazyColumn(
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth(),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(10.dp)
        ) {
            if (history.isEmpty()) {
                item {
                    val prompts = listOf(
                        "What are my most urgent deadlines this week?",
                        "帮我总结一下今天微信和WhatsApp的重要事情",
                        "Ada apa-apa perubahan jadual mesyuarat?"
                    )
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        prompts.forEach { p ->
                            SurfaceCard(
                                modifier = Modifier.clickable(enabled = !uiState.isBusy && uiState.isAuthenticated) {
                                    viewModel.sendChat(p)
                                }
                            ) {
                                Text(p, style = MaterialTheme.typography.bodyMedium)
                            }
                        }
                    }
                }
            } else {
                items(history, key = { it.id }) { msg ->
                    val isUser = msg.role == "user"
                    Column(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalAlignment = if (isUser) Alignment.End else Alignment.Start
                    ) {
                        Card(
                            shape = RoundedCornerShape(12.dp),
                            colors = CardDefaults.cardColors(
                                containerColor = if (isUser) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant
                            )
                        ) {
                            Text(
                                text = msg.content,
                                modifier = Modifier.padding(12.dp),
                                style = MaterialTheme.typography.bodyMedium,
                                color = if (isUser) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface
                            )
                        }
                        if (msg.suggestedActions.isNotEmpty()) {
                            Spacer(Modifier.height(6.dp))
                            msg.suggestedActions.forEachIndexed { idx, action ->
                                OutlinedButton(
                                    onClick = { viewModel.applyChatAction(msg.id, idx) },
                                    enabled = !action.applied && !uiState.isBusy
                                ) {
                                    if (action.applied) {
                                        Icon(Icons.Default.Check, contentDescription = null, modifier = Modifier.size(15.dp))
                                        Spacer(Modifier.width(4.dp))
                                    }
                                    Text(action.label, style = MaterialTheme.typography.labelMedium)
                                }
                            }
                        }
                    }
                }
            }

            if (uiState.isBusy) {
                item {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp),
                        modifier = Modifier.padding(vertical = 4.dp)
                    ) {
                        CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
                        Text(
                            text = strings.chatThinking,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                }
            }
        }

        HorizontalDivider()
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            OutlinedTextField(
                value = input,
                onValueChange = { input = it },
                placeholder = { Text(strings.chatPlaceholder) },
                modifier = Modifier.weight(1f),
                singleLine = true
            )
            Button(
                onClick = {
                    val trimmed = input.trim()
                    if (trimmed.isNotEmpty()) {
                        viewModel.sendChat(trimmed) {
                            input = ""
                        }
                    }
                },
                enabled = !uiState.isBusy && input.isNotBlank() && uiState.isAuthenticated
            ) {
                Icon(Icons.Default.Send, contentDescription = strings.send, modifier = Modifier.size(18.dp))
            }
        }
    }
}

@Composable
fun MemoryPrivacyScreen(
    uiState: MainUiState,
    strings: UiStrings,
    viewModel: SecretaryViewModel
) {
    val context = LocalContext.current
    val clipboard = LocalClipboardManager.current
    val state = uiState.secretaryState
    var urlInput by remember(uiState.backendUrl) { mutableStateOf(uiState.backendUrl) }
    var blockedInput by remember { mutableStateOf("") }
    var showAddMem by remember { mutableStateOf(false) }
    var showDeployGuide by remember { mutableStateOf(uiState.backendUrl.isBlank() || uiState.connectionOk == false) }
    var showVivoGuide by remember { mutableStateOf(!uiState.listenerEnabled || !uiState.batteryOptimizationIgnored) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // 3. Backend Server Connection + Quick Paste + Categorized Error Diagnostics + Formal Deployment Guide
        item {
            SurfaceCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = strings.backendUrlLabel,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold
                    )
                    ConnectionTagChip(uiState = uiState, strings = strings)
                }
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = urlInput,
                    onValueChange = { urlInput = it },
                    placeholder = { Text(strings.backendUrlPlaceholder) },
                    singleLine = true,
                    trailingIcon = {
                        IconButton(
                            onClick = {
                                val pasted = clipboard.getText()?.text?.trim().orEmpty()
                                if (pasted.isNotBlank()) {
                                    urlInput = pasted
                                    viewModel.testConnection(pasted)
                                }
                            }
                        ) {
                            Icon(Icons.Default.ContentPaste, contentDescription = strings.pasteAndTest)
                        }
                    },
                    modifier = Modifier.fillMaxWidth()
                )

                if (uiState.recentUrls.isNotEmpty()) {
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = strings.recentUrlsLabel,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    Row(
                        modifier = Modifier
                            .fillMaxWidth()
                            .horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        uiState.recentUrls.forEach { preset ->
                            FilterChip(
                                selected = urlInput.trim().trimEnd('/') == preset,
                                onClick = {
                                    urlInput = preset
                                    viewModel.testConnection(preset)
                                },
                                label = {
                                    Text(
                                        text = preset.removePrefix("https://").removePrefix("http://"),
                                        maxLines = 1,
                                        overflow = TextOverflow.Ellipsis,
                                        style = MaterialTheme.typography.labelSmall
                                    )
                                }
                            )
                        }
                    }
                }

                Spacer(Modifier.height(8.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Button(
                        onClick = { viewModel.saveBackendUrl(urlInput) },
                        enabled = !uiState.isTestingConnection
                    ) {
                        Text(strings.saveUrl)
                    }
                    OutlinedButton(
                        onClick = { viewModel.testConnection(urlInput) },
                        enabled = !uiState.isTestingConnection
                    ) {
                        Text(if (uiState.isTestingConnection) strings.testingConnection else strings.testConnection)
                    }
                    OutlinedButton(
                        onClick = {
                            val pasted = clipboard.getText()?.text?.trim().orEmpty()
                            if (pasted.isNotBlank()) {
                                urlInput = pasted
                                viewModel.testConnection(pasted)
                            }
                        },
                        enabled = !uiState.isTestingConnection
                    ) {
                        Text(strings.pasteAndTest)
                    }
                }

                uiState.connectionStatus?.let { status ->
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = status,
                        style = MaterialTheme.typography.bodySmall,
                        color = when {
                            uiState.connectionOk == true && uiState.aiServiceHealthy -> MaterialTheme.colorScheme.primary
                            else -> MaterialTheme.colorScheme.error
                        }
                    )
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { showDeployGuide = !showDeployGuide },
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = strings.deployGuideTitle,
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.SemiBold,
                        color = MaterialTheme.colorScheme.primary
                    )
                    Icon(
                        imageVector = if (showDeployGuide) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                        contentDescription = null
                    )
                }
                if (showDeployGuide) {
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = strings.deployGuideBody,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
            }
        }

        // Auth Card
        if (uiState.backendUrl.isNotBlank()) {
            item {
                if (!uiState.isAuthenticated) {
                    PasscodeUnlockCard(uiState = uiState, strings = strings, viewModel = viewModel)
                } else {
                    SurfaceCard {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp)
                            ) {
                                Icon(Icons.Default.Lock, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                                Text(
                                    text = "Workspace Authenticated",
                                    style = MaterialTheme.typography.titleSmall,
                                    fontWeight = FontWeight.SemiBold
                                )
                            }
                            OutlinedButton(onClick = { viewModel.logout() }) {
                                Text(strings.lockWorkspace)
                            }
                        }
                    }
                }
            }
        }

        // 1. Notification Read Permission, Real-Time WeChat/WhatsApp Status & vivo OriginOS Guide
        item {
            SurfaceCard {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        imageVector = if (uiState.listenerEnabled && uiState.listenerServiceBound) {
                            Icons.Default.CheckCircle
                        } else {
                            Icons.Default.Notifications
                        },
                        contentDescription = null,
                        tint = when {
                            uiState.listenerEnabled && uiState.listenerServiceBound -> MaterialTheme.colorScheme.primary
                            uiState.listenerEnabled -> MaterialTheme.colorScheme.secondary
                            else -> MaterialTheme.colorScheme.error
                        }
                    )
                    Text(
                        text = strings.listenerTitle,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    text = when {
                        uiState.listenerEnabled && uiState.listenerServiceBound -> strings.listenerGrantedBound
                        uiState.listenerEnabled -> strings.listenerGrantedWaiting
                        else -> strings.listenerMissing
                    },
                    style = MaterialTheme.typography.bodySmall,
                    color = if (uiState.listenerEnabled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                )
                uiState.lastListenerBoundMYT?.let { boundAt ->
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = "Service state updated: $boundAt",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }

                if (uiState.listenerEnabled && !uiState.listenerServiceBound) {
                    Spacer(Modifier.height(8.dp))
                    OutlinedButton(
                        onClick = { viewModel.rebindListener() },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(16.dp))
                        Spacer(Modifier.width(6.dp))
                        Text(strings.rebindListenerBtn)
                    }
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp))
                Text(
                    text = strings.channelMonitorTitle,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(Modifier.height(6.dp))
                ChannelStatusRow(
                    label = strings.wechatLabel,
                    installed = uiState.wechatInstalled,
                    enabled = state.privacy.enabledSources["wechat"] ?: true,
                    stat = uiState.wechatStat,
                    strings = strings
                )
                Spacer(Modifier.height(6.dp))
                ChannelStatusRow(
                    label = strings.whatsappLabel,
                    installed = uiState.whatsappInstalled,
                    enabled = state.privacy.enabledSources["whatsapp"] ?: true,
                    stat = uiState.whatsappStat,
                    strings = strings
                )

                HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp))
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clickable { showVivoGuide = !showVivoGuide },
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = strings.vivoGuideTitle,
                        style = MaterialTheme.typography.labelLarge,
                        fontWeight = FontWeight.SemiBold
                    )
                    Icon(
                        imageVector = if (showVivoGuide) Icons.Default.KeyboardArrowUp else Icons.Default.KeyboardArrowDown,
                        contentDescription = null
                    )
                }
                if (showVivoGuide) {
                    Spacer(Modifier.height(6.dp))
                    Text(
                        text = strings.vivoGuideSteps,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Spacer(Modifier.height(10.dp))
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = { DeadlineNotifier.openAppDetailsSettings(context) },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(strings.openAppInfoBtn)
                    }
                    Button(
                        onClick = { DeadlineNotifier.openNotificationListenerSettings(context) },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(strings.openListenerSettings)
                    }
                    OutlinedButton(
                        onClick = { DeadlineNotifier.openVivoAutostartSettings(context) },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(strings.openAutostartBtn)
                    }
                }
            }
        }

        // 2. Background Stability, Keep-Alive Guard, Offline Retry Queue & Sync Diagnostics
        item {
            SurfaceCard {
                Text(
                    text = strings.backgroundTitle,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    text = if (uiState.batteryOptimizationIgnored) strings.batteryWhitelistOk else strings.batteryWhitelistWarn,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (uiState.batteryOptimizationIgnored) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                )
                if (!uiState.batteryOptimizationIgnored) {
                    Spacer(Modifier.height(6.dp))
                    OutlinedButton(
                        onClick = { DeadlineNotifier.openBatteryOptimizationSettings(context) },
                        modifier = Modifier.fillMaxWidth()
                    ) {
                        Text(strings.openBatteryBtn)
                    }
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(modifier = Modifier.weight(1f).padding(end = 8.dp)) {
                        Text(
                            text = strings.keepAliveLabel,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.Medium
                        )
                        Spacer(Modifier.height(2.dp))
                        Text(
                            text = strings.keepAliveDesc,
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant
                        )
                    }
                    Switch(
                        checked = uiState.keepAliveEnabled,
                        onCheckedChange = { viewModel.toggleKeepAlive(it) }
                    )
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(strings.lastSyncLabel, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(
                        text = uiState.lastSyncTimeMYT ?: strings.neverSynced,
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Medium
                    )
                }
                Spacer(Modifier.height(6.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "${strings.pendingQueueLabel}: ${uiState.pendingQueueCount}",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (uiState.pendingQueueCount > 0) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant
                    )
                    if (uiState.pendingQueueCount > 0) {
                        OutlinedButton(
                            onClick = { viewModel.retryPendingQueue() },
                            contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                        ) {
                            Icon(Icons.Default.Refresh, contentDescription = null, modifier = Modifier.size(14.dp))
                            Spacer(Modifier.width(4.dp))
                            Text(strings.retryQueueBtn, style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }

                HorizontalDivider(modifier = Modifier.padding(vertical = 10.dp))
                Text(
                    text = strings.listenerDiagTitle,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(Modifier.height(4.dp))
                val diag = uiState.listenerDiagnostic
                if (diag == null) {
                    Text(
                        text = strings.listenerDiagEmpty,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                } else {
                    Text(
                        text = "${diag.timestampMYT} · ${diag.source.uppercase()} (${diag.sender})",
                        style = MaterialTheme.typography.labelMedium,
                        fontWeight = FontWeight.Medium
                    )
                    Text(
                        text = "${diag.status}: ${diag.detail}",
                        style = MaterialTheme.typography.bodySmall,
                        color = if (diag.status == "Synced") MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                    )
                }
            }
        }

        // Privacy Controls
        item {
            SurfaceCard {
                Text(
                    text = strings.privacyControls,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(Modifier.height(8.dp))
                listOf("whatsapp" to "WhatsApp", "wechat" to "WeChat", "email" to "Email", "sms" to "SMS").forEach { (key, label) ->
                    val enabled = state.privacy.enabledSources[key] ?: false
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(label, style = MaterialTheme.typography.bodyMedium)
                        Switch(
                            checked = enabled,
                            enabled = uiState.isAuthenticated,
                            onCheckedChange = { viewModel.toggleSource(key, it) }
                        )
                    }
                }
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = strings.redactLabel,
                        style = MaterialTheme.typography.bodySmall,
                        modifier = Modifier.weight(1f)
                    )
                    Switch(
                        checked = state.privacy.redactSensitiveInfo,
                        enabled = uiState.isAuthenticated,
                        onCheckedChange = { viewModel.toggleRedaction(it) }
                    )
                }
                HorizontalDivider(modifier = Modifier.padding(vertical = 8.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = blockedInput,
                        onValueChange = { blockedInput = it },
                        placeholder = { Text("Block sender...") },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    OutlinedButton(
                        enabled = uiState.isAuthenticated,
                        onClick = {
                            if (blockedInput.isNotBlank()) {
                                viewModel.addBlockedSender(blockedInput.trim())
                                blockedInput = ""
                            }
                        }
                    ) {
                        Text("Block")
                    }
                }
                state.privacy.blockedSenders.forEach { sender ->
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(sender, style = MaterialTheme.typography.bodySmall)
                        IconButton(onClick = { viewModel.removeBlockedSender(sender) }) {
                            Icon(Icons.Default.Close, contentDescription = "Unblock", modifier = Modifier.size(16.dp))
                        }
                    }
                }
            }
        }

        // Personal Memory Vault
        item {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = strings.memoryVault,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold
                )
                Button(
                    onClick = { showAddMem = true },
                    enabled = uiState.isAuthenticated
                ) {
                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(16.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(strings.addMemory)
                }
            }
        }

        items(state.memories, key = { it.id }) { mem ->
            SurfaceCard {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.Top
                ) {
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = "${mem.key} · ${mem.category}",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold
                        )
                        Spacer(Modifier.height(4.dp))
                        Text(mem.content, style = MaterialTheme.typography.bodySmall)
                    }
                    IconButton(onClick = { viewModel.deleteMemory(mem.id) }) {
                        Icon(Icons.Default.Delete, contentDescription = "Delete", modifier = Modifier.size(16.dp))
                    }
                }
            }
        }
    }

    if (showAddMem) {
        AddMemoryDialog(
            strings = strings,
            onDismiss = { showAddMem = false },
            onSave = { key, content ->
                viewModel.addMemory(key, content, "preference")
                showAddMem = false
            }
        )
    }
}

@Composable
private fun ConnectionTagChip(uiState: MainUiState, strings: UiStrings) {
    val (label, isError) = when (uiState.connectionErrorType) {
        ConnectionErrorType.NONE -> {
            if (uiState.connectionOk == true) strings.statusConnectedTag to false
            else return
        }
        ConnectionErrorType.NOT_CONFIGURED -> return
        ConnectionErrorType.SERVER_OFFLINE -> strings.errTagOffline to true
        ConnectionErrorType.NETWORK_ERROR -> strings.errTagNetwork to true
        ConnectionErrorType.AUTH_FAILED -> strings.errTagAuth to true
        ConnectionErrorType.AI_SERVICE_ERROR -> strings.errTagAi to true
    }
    Text(
        text = label,
        style = MaterialTheme.typography.labelSmall,
        fontWeight = FontWeight.SemiBold,
        color = if (isError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
    )
}

@Composable
private fun ChannelStatusRow(
    label: String,
    installed: Boolean,
    enabled: Boolean,
    stat: ChannelStats?,
    strings: UiStrings
) {
    val installTag = if (installed) strings.appInstalled else strings.appNotDetected
    val stateLine = when {
        !enabled -> "Paused in Privacy Controls"
        stat != null -> "${stat.lastStatus} · ${stat.lastSender} (${stat.lastCaptureMYT}) · Synced: ${stat.syncedCount}"
        else -> strings.channelWaiting
    }
    Column(modifier = Modifier.fillMaxWidth()) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(
                text = label,
                style = MaterialTheme.typography.bodySmall,
                fontWeight = FontWeight.SemiBold
            )
            Text(
                text = "$installTag · ${if (enabled) "ON" else "OFF"}",
                style = MaterialTheme.typography.labelSmall,
                color = if (installed && enabled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        Text(
            text = stateLine,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
    }
}

@Composable
private fun TaskRowCard(
    task: SecretaryTask,
    onToggle: () -> Unit,
    onDelete: () -> Unit,
    addToCalendarLabel: String
) {
    val context = LocalContext.current
    val isDone = task.status == "completed"
    SurfaceCard {
        Row(
            modifier = Modifier.fillMaxWidth(),
            verticalAlignment = Alignment.Top
        ) {
            Checkbox(
                checked = isDone,
                onCheckedChange = { onToggle() }
            )
            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = task.title,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    textDecoration = if (isDone) TextDecoration.LineThrough else TextDecoration.None
                )
                if (task.description.isNotBlank()) {
                    Spacer(Modifier.height(2.dp))
                    Text(
                        text = task.description,
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant
                    )
                }
                Spacer(Modifier.height(4.dp))
                val metaParts = listOfNotNull(
                    task.priority.uppercase(),
                    task.category,
                    task.dueDate?.let { "$it ${task.dueTime.orEmpty()}".trim() },
                    task.location,
                    task.sourceSender?.let { "${task.sourceApp}: $it" }
                )
                Text(
                    text = metaParts.joinToString(" · "),
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(6.dp))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(
                        onClick = { DeadlineNotifier.openAddToCalendarIntent(context, task) },
                        contentPadding = PaddingValues(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Icon(Icons.Default.CalendarMonth, contentDescription = null, modifier = Modifier.size(14.dp))
                        Spacer(Modifier.width(4.dp))
                        Text(addToCalendarLabel, style = MaterialTheme.typography.labelSmall)
                    }
                    IconButton(onClick = onDelete, modifier = Modifier.size(32.dp)) {
                        Icon(Icons.Default.Delete, contentDescription = "Delete", modifier = Modifier.size(16.dp))
                    }
                }
            }
        }
    }
}

@Composable
private fun MetricBox(
    label: String,
    value: String,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    SurfaceCard(modifier = modifier.clickable { onClick() }) {
        Text(label, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.height(4.dp))
        Text(value, style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun SurfaceCard(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit
) {
    Card(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(12.dp),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline)
    ) {
        Column(modifier = Modifier.padding(14.dp)) {
            content()
        }
    }
}

@Composable
fun CaptureMessageDialog(
    strings: UiStrings,
    onDismiss: () -> Unit,
    onSubmit: (source: String, sender: String, chatTitle: String, rawText: String) -> Unit
) {
    var source by remember { mutableStateOf("whatsapp") }
    var sender by remember { mutableStateOf("") }
    var text by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(strings.captureBtn) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("whatsapp" to "WhatsApp", "wechat" to "WeChat", "manual" to "Manual").forEach { (k, lbl) ->
                        FilterChip(
                            selected = source == k,
                            onClick = { source = k },
                            label = { Text(lbl) }
                        )
                    }
                }
                OutlinedTextField(
                    value = sender,
                    onValueChange = { sender = it },
                    label = { Text("Sender") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )
                OutlinedTextField(
                    value = text,
                    onValueChange = { text = it },
                    label = { Text("Message (EN / 中文 / BM)") },
                    minLines = 3,
                    modifier = Modifier.fillMaxWidth()
                )
            }
        },
        confirmButton = {
            Button(
                onClick = { if (text.isNotBlank()) onSubmit(source, sender, "", text.trim()) },
                enabled = text.isNotBlank()
            ) {
                Text(strings.save)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(strings.cancel) }
        }
    )
}

@Composable
private fun AddTaskDialog(
    strings: UiStrings,
    onDismiss: () -> Unit,
    onSave: (title: String, desc: String, cat: String, date: String, time: String, loc: String) -> Unit
) {
    var title by remember { mutableStateOf("") }
    var desc by remember { mutableStateOf("") }
    var cat by remember { mutableStateOf("assignment") }
    var date by remember { mutableStateOf("") }
    var time by remember { mutableStateOf("") }
    var loc by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(strings.addTask) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                    listOf("assignment" to strings.assignments, "meeting" to strings.meetings, "task" to strings.tasks).forEach { (k, lbl) ->
                        FilterChip(selected = cat == k, onClick = { cat = k }, label = { Text(lbl) })
                    }
                }
                OutlinedTextField(value = title, onValueChange = { title = it }, label = { Text("Title") }, singleLine = true)
                OutlinedTextField(value = date, onValueChange = { date = it }, label = { Text("Date (YYYY-MM-DD)") }, singleLine = true)
                OutlinedTextField(value = time, onValueChange = { time = it }, label = { Text("Time (HH:mm)") }, singleLine = true)
                OutlinedTextField(value = loc, onValueChange = { loc = it }, label = { Text("Location") }, singleLine = true)
                OutlinedTextField(value = desc, onValueChange = { desc = it }, label = { Text("Notes") })
            }
        },
        confirmButton = {
            Button(
                onClick = { if (title.isNotBlank()) onSave(title.trim(), desc.trim(), cat, date.trim(), time.trim(), loc.trim()) },
                enabled = title.isNotBlank()
            ) {
                Text(strings.save)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(strings.cancel) }
        }
    )
}

@Composable
private fun AddMemoryDialog(
    strings: UiStrings,
    onDismiss: () -> Unit,
    onSave: (key: String, content: String) -> Unit
) {
    var key by remember { mutableStateOf("") }
    var content by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(strings.addMemory) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(value = key, onValueChange = { key = it }, label = { Text("Title / Contact") }, singleLine = true)
                OutlinedTextField(value = content, onValueChange = { content = it }, label = { Text("Details") }, minLines = 2)
            }
        },
        confirmButton = {
            Button(
                onClick = { if (key.isNotBlank() && content.isNotBlank()) onSave(key.trim(), content.trim()) },
                enabled = key.isNotBlank() && content.isNotBlank()
            ) {
                Text(strings.save)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text(strings.cancel) }
        }
    )
}
