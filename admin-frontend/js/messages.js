/**
 * Admin Messages JavaScript
 * 
 * Handles messaging functionality for admins including:
 * - Viewing inbox and sent messages
 * - Composing new messages to any user
 * - Broadcasting messages to users by role
 * - Replying to messages
 * - Message search and filtering
 */

let currentMessageTab = 'inbox';
let currentMessagePage = 1;
let totalMessagePages = 1;
let messageUnreadCount = 0;
let allMessages = [];
let allUsers = [];

/**
 * Initialize messaging when messages page is loaded
 */
function initMessages() {
    loadMessages();
    loadAllUsers();
    loadUnreadCount();
}

/**
 * Load unread message count for badge
 */
async function loadUnreadCount() {
    const response = await API.get('/messages/inbox?unread=true&limit=1');
    if (response.ok && response.data.success) {
        messageUnreadCount = response.data.unreadCount || 0;
        updateMessageBadges();
    }
}

/**
 * Update unread badges
 */
function updateMessageBadges() {
    const navBadge = document.getElementById('unreadBadge');
    const inboxBadge = document.getElementById('inboxBadge');
    
    if (messageUnreadCount > 0) {
        if (navBadge) {
            navBadge.textContent = messageUnreadCount;
            navBadge.classList.remove('hidden');
        }
        if (inboxBadge) {
            inboxBadge.textContent = messageUnreadCount;
            inboxBadge.classList.remove('hidden');
        }
    } else {
        if (navBadge) navBadge.classList.add('hidden');
        if (inboxBadge) inboxBadge.classList.add('hidden');
    }
}

/**
 * Load messages based on current tab
 */
async function loadMessages() {
    const container = document.getElementById('messagesList');
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Loading messages...</div>';
    
    const endpoint = currentMessageTab === 'inbox' 
        ? `/messages/inbox?page=${currentMessagePage}&limit=50` 
        : `/messages/sent?page=${currentMessagePage}&limit=50`;
    
    const response = await API.get(endpoint);
    
    if (response.ok && response.data.success) {
        allMessages = response.data.messages;
        const pagination = response.data.pagination;
        
        totalMessagePages = pagination.totalPages || 1;
        
        // Update unread count for inbox
        if (currentMessageTab === 'inbox' && response.data.unreadCount !== undefined) {
            messageUnreadCount = response.data.unreadCount;
            updateMessageBadges();
        }
        
        renderFilteredMessages();
    } else {
        container.innerHTML = '<p class="text-center">Failed to load messages.</p>';
        updateMessagePagination(false);
    }
}

/**
 * Filter and render messages based on search and filters
 */
function filterMessages() {
    renderFilteredMessages();
}

/**
 * Render filtered messages
 */
function renderFilteredMessages() {
    const container = document.getElementById('messagesList');
    if (!container) return;
    
    const searchTerm = (document.getElementById('messageSearch')?.value || '').toLowerCase();
    const roleFilter = document.getElementById('messageRoleFilter')?.value || '';
    
    let filteredMessages = allMessages.filter(msg => {
        // Search filter
        const searchMatch = !searchTerm || 
            msg.subject.toLowerCase().includes(searchTerm) ||
            msg.body.toLowerCase().includes(searchTerm) ||
            (msg.sender_first_name + ' ' + msg.sender_last_name).toLowerCase().includes(searchTerm) ||
            (msg.recipient_first_name + ' ' + msg.recipient_last_name).toLowerCase().includes(searchTerm);
        
        // Role filter
        const isInbox = currentMessageTab === 'inbox';
        const relevantRole = isInbox ? msg.sender_role : msg.recipient_role;
        const roleMatch = !roleFilter || relevantRole === roleFilter;
        
        return searchMatch && roleMatch;
    });
    
    if (filteredMessages.length === 0) {
        container.innerHTML = `
            <div class="text-center" style="padding: 40px;">
                <p>${allMessages.length === 0 
                    ? (currentMessageTab === 'inbox' ? 'No messages in your inbox.' : 'No sent messages.') 
                    : 'No messages match your filter criteria.'}</p>
            </div>
        `;
        updateMessagePagination(false);
        return;
    }
    
    container.innerHTML = filteredMessages.map(msg => createMessageCard(msg)).join('');
    updateMessagePagination(allMessages.length > 0 && totalMessagePages > 1);
}

/**
 * Create message card HTML
 */
function createMessageCard(message) {
    const isInbox = currentMessageTab === 'inbox';
    const otherParty = isInbox 
        ? `${message.sender_first_name} ${message.sender_last_name}` 
        : `${message.recipient_first_name} ${message.recipient_last_name}`;
    const role = isInbox ? message.sender_role : message.recipient_role;
    const roleLabel = role ? `(${capitalize(role)})` : '';
    const isUnread = isInbox && !message.is_read;
    
    const date = new Date(message.created_at);
    const formattedDate = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
    const formattedTime = date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
    });
    
    return `
        <div class="message-card ${isUnread ? 'unread' : ''}" onclick="viewMessage(${message.id})">
            <div class="message-header">
                <span class="message-from">
                    ${isUnread ? '● ' : ''}
                    <strong>${isInbox ? 'From:' : 'To:'}</strong> ${escapeHtml(otherParty)} 
                    <span class="role-badge role-${role}">${roleLabel}</span>
                </span>
                <span class="message-date">${formattedDate} at ${formattedTime}</span>
            </div>
            <div class="message-subject">${escapeHtml(message.subject)}</div>
            <div class="message-preview">${escapeHtml(truncateText(message.body, 100))}</div>
            ${message.parent_id ? '<span class="message-reply-indicator">↩️ Reply</span>' : ''}
        </div>
    `;
}

/**
 * View a single message
 */
async function viewMessage(messageId) {
    const container = document.getElementById('viewMessageContent');
    container.innerHTML = '<div class="loading">Loading message...</div>';
    openModal('viewModal');
    
    const response = await API.get(`/messages/${messageId}`);
    
    if (response.ok && response.data.success) {
        const msg = response.data.message;
        const parent = response.data.parent;
        const replies = response.data.replies || [];
        
        // Update unread count after viewing
        const userData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.USER));
        if (!msg.is_read && msg.recipient_id === userData?.id) {
            messageUnreadCount = Math.max(0, messageUnreadCount - 1);
            updateMessageBadges();
            loadMessages();
        }
        
        const date = new Date(msg.created_at);
        const formattedDate = date.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        const formattedTime = date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit'
        });
        
        let html = `
            <div class="message-detail">
                <h2>${escapeHtml(msg.subject)}</h2>
                <div class="message-meta">
                    <p><strong>From:</strong> ${escapeHtml(msg.sender_first_name)} ${escapeHtml(msg.sender_last_name)} 
                        <span class="role-badge role-${msg.sender_role}">(${capitalize(msg.sender_role)})</span></p>
                    <p><strong>To:</strong> ${escapeHtml(msg.recipient_first_name)} ${escapeHtml(msg.recipient_last_name)} 
                        <span class="role-badge role-${msg.recipient_role}">(${capitalize(msg.recipient_role)})</span></p>
                    <p><strong>Date:</strong> ${formattedDate} at ${formattedTime}</p>
                </div>
        `;
        
        if (parent) {
            html += `
                <div class="message-parent">
                    <h4>Original Message:</h4>
                    <div class="parent-content">
                        <p class="parent-meta">From ${escapeHtml(parent.sender_first_name)} ${escapeHtml(parent.sender_last_name)} - ${new Date(parent.created_at).toLocaleDateString()}</p>
                        <p>${escapeHtml(parent.body)}</p>
                    </div>
                </div>
            `;
        }
        
        html += `
                <div class="message-body">
                    ${escapeHtml(msg.body).replace(/\n/g, '<br>')}
                </div>
        `;
        
        if (replies.length > 0) {
            html += '<div class="message-replies"><h4>Replies:</h4>';
            for (const reply of replies) {
                const replyDate = new Date(reply.created_at);
                html += `
                    <div class="reply-item">
                        <p class="reply-meta">${escapeHtml(reply.sender_first_name)} ${escapeHtml(reply.sender_last_name)} - ${replyDate.toLocaleDateString()} at ${replyDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>
                        <p class="reply-body">${escapeHtml(reply.body).replace(/\n/g, '<br>')}</p>
                    </div>
                `;
            }
            html += '</div>';
        }
        
        const canReply = msg.sender_id !== userData?.id;
        
        html += `
                <div class="message-actions">
                    ${canReply ? `<button class="btn btn-primary" onclick="showReplyModal(${msg.id}, '${escapeQuotes(msg.subject)}', '${escapeQuotes(msg.sender_first_name + ' ' + msg.sender_last_name)}')">↩️ Reply</button>` : ''}
                    <button class="btn btn-danger" onclick="deleteMessage(${msg.id})">🗑️ Delete</button>
                </div>
            </div>
        `;
        
        container.innerHTML = html;
    } else {
        container.innerHTML = '<p class="text-center">Failed to load message.</p>';
    }
}

/**
 * Show compose modal
 */
function showComposeModal() {
    document.getElementById('composeForm').reset();
    document.getElementById('composeError').classList.add('hidden');
    document.getElementById('composeSuccess').classList.add('hidden');
    updateRecipientDropdown();
    openModal('composeModal');
}

/**
 * Load all users for recipient selection
 */
async function loadAllUsers() {
    const response = await API.get('/users?limit=500');
    
    if (response.ok && response.data.success) {
        allUsers = response.data.users.filter(u => u.is_active);
    }
}

/**
 * Update recipient dropdown with all users
 */
function updateRecipientDropdown() {
    const select = document.getElementById('recipientSelect');
    if (!select || allUsers.length === 0) return;
    
    const userData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.USER));
    const filteredUsers = allUsers.filter(u => u.id !== userData?.id);
    
    // Group users by role
    const customers = filteredUsers.filter(u => u.role === 'customer');
    const agents = filteredUsers.filter(u => u.role === 'agent');
    const admins = filteredUsers.filter(u => u.role === 'admin');
    
    let html = '<option value="">-- Select recipient --</option>';
    
    if (agents.length > 0) {
        html += '<optgroup label="Agents">';
        for (const user of agents) {
            html += `<option value="${user.id}">${escapeHtml(user.first_name + ' ' + user.last_name)} (${user.email})</option>`;
        }
        html += '</optgroup>';
    }
    
    if (customers.length > 0) {
        html += '<optgroup label="Customers">';
        for (const user of customers) {
            html += `<option value="${user.id}">${escapeHtml(user.first_name + ' ' + user.last_name)} (${user.email})</option>`;
        }
        html += '</optgroup>';
    }
    
    if (admins.length > 0) {
        html += '<optgroup label="Admins">';
        for (const user of admins) {
            html += `<option value="${user.id}">${escapeHtml(user.first_name + ' ' + user.last_name)} (${user.email})</option>`;
        }
        html += '</optgroup>';
    }
    
    select.innerHTML = html;
}

/**
 * Send a new message
 */
async function sendMessage(event) {
    event.preventDefault();
    
    const errorDiv = document.getElementById('composeError');
    const successDiv = document.getElementById('composeSuccess');
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    
    const recipientId = document.getElementById('recipientSelect').value;
    const subject = document.getElementById('messageSubject').value.trim();
    const body = document.getElementById('messageBody').value.trim();
    
    if (!recipientId) {
        errorDiv.textContent = 'Please select a recipient.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    const response = await API.post('/messages', {
        recipientId: parseInt(recipientId),
        subject,
        body
    });
    
    if (response.ok && response.data.success) {
        successDiv.textContent = 'Message sent successfully!';
        successDiv.classList.remove('hidden');
        
        setTimeout(() => {
            closeModal('composeModal');
            if (currentMessageTab === 'sent') {
                loadMessages();
            } else {
                switchMessageTab('sent');
            }
        }, 1500);
    } else {
        errorDiv.textContent = response.data.error || 'Failed to send message.';
        errorDiv.classList.remove('hidden');
    }
}

/**
 * Show broadcast modal
 */
function showBroadcastModal() {
    document.getElementById('broadcastForm').reset();
    document.getElementById('broadcastError').classList.add('hidden');
    document.getElementById('broadcastSuccess').classList.add('hidden');
    openModal('broadcastModal');
}

/**
 * Send broadcast message
 */
async function sendBroadcast(event) {
    event.preventDefault();
    
    const errorDiv = document.getElementById('broadcastError');
    const successDiv = document.getElementById('broadcastSuccess');
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    
    const role = document.getElementById('broadcastRole').value;
    const subject = document.getElementById('broadcastSubject').value.trim();
    const body = document.getElementById('broadcastBody').value.trim();
    
    if (!role) {
        errorDiv.textContent = 'Please select an audience.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    // Get recipients based on role selection
    const userData = JSON.parse(localStorage.getItem(CONFIG.STORAGE_KEYS.USER));
    let recipients = [];
    
    if (role === 'all') {
        recipients = allUsers.filter(u => u.id !== userData?.id);
    } else {
        recipients = allUsers.filter(u => u.role === role && u.id !== userData?.id);
    }
    
    if (recipients.length === 0) {
        errorDiv.textContent = 'No recipients found for the selected audience.';
        errorDiv.classList.remove('hidden');
        return;
    }
    
    // Confirm before sending
    if (!confirm(`This will send ${recipients.length} message(s) to ${role === 'all' ? 'all users' : 'all ' + role + 's'}. Continue?`)) {
        return;
    }
    
    // Send messages to each recipient
    let successCount = 0;
    let failCount = 0;
    
    for (const recipient of recipients) {
        const response = await API.post('/messages', {
            recipientId: recipient.id,
            subject: `[Broadcast] ${subject}`,
            body
        });
        
        if (response.ok && response.data.success) {
            successCount++;
        } else {
            failCount++;
        }
    }
    
    if (failCount === 0) {
        successDiv.textContent = `Broadcast sent successfully to ${successCount} recipient(s)!`;
        successDiv.classList.remove('hidden');
        
        setTimeout(() => {
            closeModal('broadcastModal');
            loadMessages();
        }, 2000);
    } else {
        errorDiv.textContent = `Sent ${successCount} message(s), failed ${failCount}. Some messages may not have been delivered.`;
        errorDiv.classList.remove('hidden');
    }
}

/**
 * Show reply modal
 */
function showReplyModal(messageId, subject, senderName) {
    document.getElementById('replyParentId').value = messageId;
    document.getElementById('replyContext').textContent = `Replying to: ${senderName} - "${subject}"`;
    document.getElementById('replyForm').reset();
    document.getElementById('replyError').classList.add('hidden');
    document.getElementById('replySuccess').classList.add('hidden');
    closeModal('viewModal');
    openModal('replyModal');
}

/**
 * Send reply
 */
async function sendReply(event) {
    event.preventDefault();
    
    const errorDiv = document.getElementById('replyError');
    const successDiv = document.getElementById('replySuccess');
    errorDiv.classList.add('hidden');
    successDiv.classList.add('hidden');
    
    const parentId = document.getElementById('replyParentId').value;
    const body = document.getElementById('replyBody').value.trim();
    
    const response = await API.post(`/messages/${parentId}/reply`, { body });
    
    if (response.ok && response.data.success) {
        successDiv.textContent = 'Reply sent successfully!';
        successDiv.classList.remove('hidden');
        
        setTimeout(() => {
            closeModal('replyModal');
            loadMessages();
        }, 1500);
    } else {
        errorDiv.textContent = response.data.error || 'Failed to send reply.';
        errorDiv.classList.remove('hidden');
    }
}

/**
 * Delete message
 */
async function deleteMessage(messageId) {
    if (!confirm('Are you sure you want to delete this message?')) {
        return;
    }
    
    const response = await API.delete(`/messages/${messageId}`);
    
    if (response.ok && response.data.success) {
        closeModal('viewModal');
        loadMessages();
        alert('Message deleted successfully.');
    } else {
        alert(response.data.error || 'Failed to delete message.');
    }
}

/**
 * Switch between inbox and sent tabs
 */
function switchMessageTab(tab) {
    currentMessageTab = tab;
    currentMessagePage = 1;
    
    // Reset filters
    const searchInput = document.getElementById('messageSearch');
    const roleFilter = document.getElementById('messageRoleFilter');
    if (searchInput) searchInput.value = '';
    if (roleFilter) roleFilter.value = '';
    
    document.querySelectorAll('.messages-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    
    loadMessages();
}

/**
 * Change message page
 */
function changeMessagePage(delta) {
    const newPage = currentMessagePage + delta;
    if (newPage >= 1 && newPage <= totalMessagePages) {
        currentMessagePage = newPage;
        loadMessages();
    }
}

/**
 * Update pagination UI
 */
function updateMessagePagination(show) {
    const pagination = document.getElementById('messagesPagination');
    const prevBtn = document.getElementById('prevMsgPage');
    const nextBtn = document.getElementById('nextMsgPage');
    const pageInfo = document.getElementById('msgPageInfo');
    
    if (!pagination) return;
    
    if (show && totalMessagePages > 1) {
        pagination.classList.remove('hidden');
        if (pageInfo) pageInfo.textContent = `Page ${currentMessagePage} of ${totalMessagePages}`;
        if (prevBtn) prevBtn.disabled = currentMessagePage <= 1;
        if (nextBtn) nextBtn.disabled = currentMessagePage >= totalMessagePages;
    } else {
        pagination.classList.add('hidden');
    }
}

/**
 * Truncate text
 */
function truncateText(text, maxLength) {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

/**
 * Escape quotes for inline JS
 */
function escapeQuotes(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/\\/g, '\\\\')
        .replace(/'/g, "\\'")
        .replace(/"/g, '\\"');
}

/**
 * Capitalize first letter
 */
function capitalize(str) {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}
