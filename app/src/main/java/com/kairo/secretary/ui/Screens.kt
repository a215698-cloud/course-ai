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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.AutoAwesome
import androidx.compose.material.icons.filled.CalendarMonth
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Notifications
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Send
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.kairo.secretary.data.IngestedMessage
import com.kairo.secretary.data.SecretaryTask
import com.kairo.secretary.notifications.DeadlineNotifier

@Composable
fun OverviewScreen(
    uiState: MainUiState,
    strings: UiStrings,
    viewModel: SecretaryViewModel,
    onOpenTasks: () -> Unit,
    onOpenInbox: () -> Unit
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
                        enabled = !uiState.isBusy,
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
                        enabled = !uiState.isBusy,
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
    viewModel: SecretaryViewModel
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
                    enabled = !uiState.isBusy
                ) {
                    Text(strings.loadSamples)
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
            Button(onClick = { showAddDialog = true }) {
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
    viewModel: SecretaryViewModel
) {
    var input by remember { mutableStateOf("") }
    val history = uiState.secretaryState.chatHistory

    Column(modifier = Modifier.fillMaxSize()) {
        if (history.isNotEmpty()) {
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.End
            ) {
                TextButton(onClick = { viewModel.clearChat() }) {
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
                            SurfaceCard(modifier = Modifier.clickable { viewModel.sendChat(p) }) {
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
                                    enabled = !action.applied
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
                        input = ""
                        viewModel.sendChat(trimmed)
                    }
                },
                enabled = !uiState.isBusy && input.isNotBlank()
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
    val state = uiState.secretaryState
    var urlInput by remember(uiState.backendUrl) { mutableStateOf(uiState.backendUrl) }
    var blockedInput by remember { mutableStateOf("") }
    var showAddMem by remember { mutableStateOf(false) }

    LazyColumn(
        modifier = Modifier.fillMaxSize(),
        contentPadding = PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Native Android NotificationListenerService Card
        item {
            SurfaceCard {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Icon(
                        Icons.Default.Notifications,
                        contentDescription = null,
                        tint = if (uiState.listenerEnabled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
                    )
                    Text(
                        text = strings.listenerTitle,
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold
                    )
                }
                Spacer(Modifier.height(6.dp))
                Text(
                    text = if (uiState.listenerEnabled) strings.listenerGranted else strings.listenerMissing,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
                Spacer(Modifier.height(10.dp))
                Button(onClick = { DeadlineNotifier.openNotificationListenerSettings(context) }) {
                    Text(strings.openListenerSettings)
                }
            }
        }

        // Backend Proxy URL Configuration (Zero API Keys in APK)
        item {
            SurfaceCard {
                Text(
                    text = strings.backendUrlLabel,
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold
                )
                Spacer(Modifier.height(8.dp))
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    OutlinedTextField(
                        value = urlInput,
                        onValueChange = { urlInput = it },
                        singleLine = true,
                        modifier = Modifier.weight(1f)
                    )
                    Button(onClick = { viewModel.saveBackendUrl(urlInput) }) {
                        Text(strings.saveUrl)
                    }
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
                    OutlinedButton(onClick = {
                        if (blockedInput.isNotBlank()) {
                            viewModel.addBlockedSender(blockedInput.trim())
                            blockedInput = ""
                        }
                    }) {
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
                Button(onClick = { showAddMem = true }) {
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
