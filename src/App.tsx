// ============================================================
// App — DopeOffice Workspace (Notion-inspired)
// ============================================================
// A clean workspace UI with sidebar navigation, template gallery,
// document management, and the DopeCanvas paged editor.
// ============================================================

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { DopeCanvas, useFormattingState, useSelectionSaver } from 'dopecanvas';
import type { DopeCanvasHandle } from 'dopecanvas';
import 'dopecanvas/style.css';

// ----------------------------------------------------------
// Types
// ----------------------------------------------------------

interface DocMeta {
  id: string;
  title: string;
  icon: string;
  createdAt: number;
  updatedAt: number;
  templateId?: string;
}

type SaveStatus = 'saved' | 'unsaved' | 'saving';
type View = 'home' | 'editor';

// ----------------------------------------------------------
// Constants
// ----------------------------------------------------------

const LS_DOCS_INDEX = 'dopecanvas_docs_index';
const LS_DOC_PREFIX = 'dopecanvas_doc_';
const LS_AI_ENDPOINT = 'dopecanvas_ai_endpoint';

const DEFAULT_AI_ENDPOINT = 'http://127.0.0.1:8083';

const AI_SYSTEM_PROMPT = `You are a professional document writer for DopeOffice. Generate well-structured HTML content.

Output rules:
- Output ONLY HTML body content (NO <html>, <head>, <body>, <style> tags, NO markdown code fences)
- Use inline styles for all formatting
- Heading styles: color #1a1a2e; font-family Georgia, serif (h1: font-size 26px; h2: font-size 20px, margin-top 24px; h3: font-size 16px, margin-top 16px)
- Body text: color #333; font-size 14px; line-height 1.7
- Lists: line-height 1.8; color #333; font-size 14px; padding-left 24px
- Tables: width 100%; border-collapse collapse; font-size 14px. Header row: background #1a1a2e; color #fff. Cells: padding 10px 14px; text-align left. Body rows alternate: even rows background #f8f9fa. Cell border-bottom: 1px solid #dee2e6
- For colored tags/badges use: display inline-block; padding 2px 8px; border-radius 10px; font-size 11px; font-weight 600
- Use <div style="break-before: page;"></div> for page breaks in long documents
- Make content thorough, professional, and well-organized with appropriate structure`;

// Common document icons for the picker
const DOCUMENT_ICONS = [
  '📄', '📝', '📋', '📑', '📃', '🗒️', '📓', '📔', '📕', '📗', '📘', '📙',
  '✏️', '🖊️', '🖋️', '📌', '📍', '🔖', '🏷️', '💼', '📁', '📂', '🗂️', '🗃️',
  '💡', '⭐', '🌟', '✨', '🎯', '🎨', '🔧', '⚙️', '🛠️', '🧪', '🔬', '📊',
  '📈', '📉', '💹', '🏆', '🎖️', '🥇', '🎁', '🎀', '🎉', '🎊', '🎈', '🎄',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💯', '✅', '☑️', '🔲',
];

const TEMPLATES = [
  {
    id: 'blank',
    title: 'Empty Document',
    icon: '📄',
    description: 'Start from scratch with a clean page',
    gradient: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
  },
  {
    id: 'team',
    title: 'Team Overview',
    icon: '👥',
    description: 'Team structure, roles and objectives',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },
  {
    id: 'charts',
    title: 'Sales Report',
    icon: '📊',
    description: 'Data-driven report with charts',
    gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  },
  {
    id: 'planning',
    title: 'Weekly Planning',
    icon: '🎯',
    description: 'Goals, tasks, and weekly schedule',
    gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  },
  {
    id: 'meeting',
    title: 'Meeting Notes',
    icon: '📝',
    description: 'Agenda, notes, and action items',
    gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  },
  {
    id: 'project',
    title: 'Project Brief',
    icon: '🚀',
    description: 'Project overview, timeline and team',
    gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  },
];

// ----------------------------------------------------------
// Inline HTML templates
// ----------------------------------------------------------

const today = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

const INLINE_TEMPLATES: Record<string, string> = {
  blank: `
    <h1 style="color: #37352f; font-family: Georgia, serif; font-size: 32px;">Untitled</h1>
    <p style="color: #b4b4b0; line-height: 1.7;">Start writing here...</p>
  `,
  team: `
    <h1 style="color: #37352f; font-family: Georgia, serif; font-size: 26px;">Team Overview</h1>
    <p style="color: #787774; font-size: 13px; border-bottom: 2px solid #37352f; padding-bottom: 10px;">
      ${today}
    </p>

    <h2 style="color: #37352f; font-family: Georgia, serif; margin-top: 28px; font-size: 20px;">📌 About This Team</h2>
    <p style="color: #37352f; line-height: 1.7; font-size: 14px;">
      Describe your team's mission, purpose, and what makes it unique...
    </p>

    <h2 style="color: #37352f; font-family: Georgia, serif; margin-top: 28px; font-size: 20px;">👥 Team Members</h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 8px;">
      <thead>
        <tr style="background: #f7f7f5;">
          <th style="padding: 10px 14px; text-align: left; border-bottom: 2px solid #e0e0e0; font-weight: 600;">Name</th>
          <th style="padding: 10px 14px; text-align: left; border-bottom: 2px solid #e0e0e0; font-weight: 600;">Role</th>
          <th style="padding: 10px 14px; text-align: left; border-bottom: 2px solid #e0e0e0; font-weight: 600;">Focus Area</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Team Lead Name</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Team Lead</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Strategy & Coordination</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Member Name</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Role Title</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Primary responsibility</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Member Name</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Role Title</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Primary responsibility</td>
        </tr>
      </tbody>
    </table>

    <h2 style="color: #37352f; font-family: Georgia, serif; margin-top: 28px; font-size: 20px;">🎯 Team Objectives</h2>
    <ol style="line-height: 1.8; color: #37352f; font-size: 14px; padding-left: 24px;">
      <li>First key objective for this quarter</li>
      <li>Second key objective</li>
      <li>Third key objective</li>
    </ol>

    <h2 style="color: #37352f; font-family: Georgia, serif; margin-top: 28px; font-size: 20px;">📊 Key Metrics</h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 8px;">
      <thead>
        <tr style="background: #f7f7f5;">
          <th style="padding: 10px 14px; text-align: left; border-bottom: 2px solid #e0e0e0; font-weight: 600;">Metric</th>
          <th style="padding: 10px 14px; text-align: left; border-bottom: 2px solid #e0e0e0; font-weight: 600;">Target</th>
          <th style="padding: 10px 14px; text-align: left; border-bottom: 2px solid #e0e0e0; font-weight: 600;">Current</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Metric 1</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">—</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">—</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Metric 2</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">—</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">—</td>
        </tr>
      </tbody>
    </table>

    <h2 style="color: #37352f; font-family: Georgia, serif; margin-top: 28px; font-size: 20px;">🔗 Resources</h2>
    <ul style="line-height: 1.8; color: #37352f; font-size: 14px; padding-left: 24px;">
      <li>Team channel: <em>Link here</em></li>
      <li>Documentation: <em>Link here</em></li>
      <li>Project board: <em>Link here</em></li>
    </ul>
  `,
  charts: `
    <h1 style="color: #37352f; font-family: Georgia, serif; font-size: 26px;">Sales Report</h1>
    <p style="color: #787774; font-size: 13px; border-bottom: 2px solid #37352f; padding-bottom: 10px;">
      ${today}
    </p>

    <h2 style="color: #37352f; font-family: Georgia, serif; margin-top: 28px; font-size: 20px;">📈 Executive Summary</h2>
    <p style="color: #37352f; line-height: 1.7; font-size: 14px;">
      Provide a brief overview of sales performance, key wins, and areas for improvement...
    </p>

    <h2 style="color: #37352f; font-family: Georgia, serif; margin-top: 28px; font-size: 20px;">💰 Revenue by Quarter</h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 8px;">
      <thead>
        <tr style="background: #37352f; color: #fff;">
          <th style="padding: 10px 14px; text-align: left; font-weight: 600;">Quarter</th>
          <th style="padding: 10px 14px; text-align: right; font-weight: 600;">Revenue</th>
          <th style="padding: 10px 14px; text-align: right; font-weight: 600;">Growth</th>
          <th style="padding: 10px 14px; text-align: left; font-weight: 600;">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Q1</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8; text-align: right;">$0</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8; text-align: right;">—</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;"><span style="background: #e0f7e9; color: #27ae60; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">On Track</span></td>
        </tr>
        <tr style="background: #f8f9fa;">
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Q2</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8; text-align: right;">$0</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8; text-align: right;">—</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;"><span style="background: #fff3e0; color: #e67e22; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">Pending</span></td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Q3</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8; text-align: right;">$0</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8; text-align: right;">—</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;"><span style="background: #fff3e0; color: #e67e22; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">Pending</span></td>
        </tr>
        <tr style="background: #f8f9fa;">
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Q4</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8; text-align: right;">$0</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8; text-align: right;">—</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;"><span style="background: #fff3e0; color: #e67e22; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">Pending</span></td>
        </tr>
      </tbody>
    </table>

    <h2 style="color: #37352f; font-family: Georgia, serif; margin-top: 28px; font-size: 20px;">🏆 Top Products</h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 8px;">
      <thead>
        <tr style="background: #f7f7f5;">
          <th style="padding: 10px 14px; text-align: left; border-bottom: 2px solid #e0e0e0; font-weight: 600;">Product</th>
          <th style="padding: 10px 14px; text-align: right; border-bottom: 2px solid #e0e0e0; font-weight: 600;">Units Sold</th>
          <th style="padding: 10px 14px; text-align: right; border-bottom: 2px solid #e0e0e0; font-weight: 600;">Revenue</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Product A</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8; text-align: right;">—</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8; text-align: right;">$0</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Product B</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8; text-align: right;">—</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8; text-align: right;">$0</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Product C</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8; text-align: right;">—</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8; text-align: right;">$0</td>
        </tr>
      </tbody>
    </table>

    <h2 style="color: #37352f; font-family: Georgia, serif; margin-top: 28px; font-size: 20px;">🌍 Regional Performance</h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 8px;">
      <thead>
        <tr style="background: #f7f7f5;">
          <th style="padding: 10px 14px; text-align: left; border-bottom: 2px solid #e0e0e0; font-weight: 600;">Region</th>
          <th style="padding: 10px 14px; text-align: right; border-bottom: 2px solid #e0e0e0; font-weight: 600;">Revenue</th>
          <th style="padding: 10px 14px; text-align: right; border-bottom: 2px solid #e0e0e0; font-weight: 600;">% of Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">North America</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8; text-align: right;">$0</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8; text-align: right;">—%</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Europe</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8; text-align: right;">$0</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8; text-align: right;">—%</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Asia-Pacific</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8; text-align: right;">$0</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8; text-align: right;">—%</td>
        </tr>
      </tbody>
    </table>

    <h2 style="color: #37352f; font-family: Georgia, serif; margin-top: 28px; font-size: 20px;">📋 Key Takeaways</h2>
    <ul style="line-height: 1.8; color: #37352f; font-size: 14px; padding-left: 24px;">
      <li>Key insight or achievement</li>
      <li>Areas for improvement</li>
      <li>Next steps and recommendations</li>
    </ul>
  `,
  planning: `
    <h1 style="color: #37352f; font-family: Georgia, serif; font-size: 26px;">Weekly Planning</h1>
    <p style="color: #787774; font-size: 13px; border-bottom: 2px solid #37352f; padding-bottom: 10px;">
      Week of ${today}
    </p>

    <h2 style="color: #37352f; font-family: Georgia, serif; margin-top: 28px; font-size: 20px;">🎯 Weekly Goals</h2>
    <ol style="line-height: 1.8; color: #37352f; font-size: 14px; padding-left: 24px;">
      <li>Primary goal for this week</li>
      <li>Secondary goal</li>
      <li>Third goal</li>
    </ol>

    <h2 style="color: #37352f; font-family: Georgia, serif; margin-top: 28px; font-size: 20px;">📋 Tasks</h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 8px;">
      <thead>
        <tr style="background: #f7f7f5;">
          <th style="padding: 10px 14px; text-align: left; border-bottom: 2px solid #e0e0e0; font-weight: 600;">Task</th>
          <th style="padding: 10px 14px; text-align: left; border-bottom: 2px solid #e0e0e0; font-weight: 600;">Priority</th>
          <th style="padding: 10px 14px; text-align: left; border-bottom: 2px solid #e0e0e0; font-weight: 600;">Due</th>
          <th style="padding: 10px 14px; text-align: left; border-bottom: 2px solid #e0e0e0; font-weight: 600;">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Task 1</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;"><span style="background: #ffe0e0; color: #c0392b; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">High</span></td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Monday</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Not Started</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Task 2</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;"><span style="background: #fff3e0; color: #e67e22; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">Medium</span></td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Wednesday</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Not Started</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Task 3</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;"><span style="background: #e0f7e9; color: #27ae60; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">Low</span></td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Friday</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Not Started</td>
        </tr>
      </tbody>
    </table>

    <h2 style="color: #37352f; font-family: Georgia, serif; margin-top: 28px; font-size: 20px;">📅 Schedule</h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 8px;">
      <thead>
        <tr style="background: #f7f7f5;">
          <th style="padding: 10px 14px; text-align: left; border-bottom: 2px solid #e0e0e0; font-weight: 600;">Day</th>
          <th style="padding: 10px 14px; text-align: left; border-bottom: 2px solid #e0e0e0; font-weight: 600;">Time</th>
          <th style="padding: 10px 14px; text-align: left; border-bottom: 2px solid #e0e0e0; font-weight: 600;">Event</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Monday</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">9:00 AM</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Team standup</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Wednesday</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">2:00 PM</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Project review</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Friday</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">4:00 PM</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Week wrap-up</td>
        </tr>
      </tbody>
    </table>

    <h2 style="color: #37352f; font-family: Georgia, serif; margin-top: 28px; font-size: 20px;">💡 Notes & Ideas</h2>
    <ul style="line-height: 1.8; color: #37352f; font-size: 14px; padding-left: 24px;">
      <li>Idea or note for the week</li>
      <li>Something to remember</li>
      <li>Follow-up items</li>
    </ul>

    <h2 style="color: #37352f; font-family: Georgia, serif; margin-top: 28px; font-size: 20px;">✅ End of Week Review</h2>
    <p style="color: #37352f; line-height: 1.7; font-size: 14px;">
      <strong>What went well:</strong> <em>Add notes here...</em>
    </p>
    <p style="color: #37352f; line-height: 1.7; font-size: 14px;">
      <strong>What to improve:</strong> <em>Add notes here...</em>
    </p>
  `,
  meeting: `
    <h1 style="color: #37352f; font-family: Georgia, serif; font-size: 26px;">Meeting Notes</h1>
    <p style="color: #787774; font-size: 13px; border-bottom: 2px solid #37352f; padding-bottom: 10px;">
      ${today}
    </p>

    <h2 style="color: #37352f; font-family: Georgia, serif; margin-top: 28px; font-size: 20px;">👤 Attendees</h2>
    <ul style="line-height: 1.8; color: #37352f; font-size: 14px; padding-left: 24px;">
      <li>Name 1 — Role</li>
      <li>Name 2 — Role</li>
      <li>Name 3 — Role</li>
    </ul>

    <h2 style="color: #37352f; font-family: Georgia, serif; margin-top: 28px; font-size: 20px;">📋 Agenda</h2>
    <ol style="line-height: 1.8; color: #37352f; font-size: 14px; padding-left: 24px;">
      <li>Review previous action items</li>
      <li>Topic discussion</li>
      <li>Next steps and timeline</li>
    </ol>

    <h2 style="color: #37352f; font-family: Georgia, serif; margin-top: 28px; font-size: 20px;">📝 Discussion Notes</h2>
    <p style="color: #37352f; line-height: 1.7; font-size: 14px;">
      Add your meeting notes here...
    </p>

    <h2 style="color: #37352f; font-family: Georgia, serif; margin-top: 28px; font-size: 20px;">✅ Action Items</h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 8px;">
      <thead>
        <tr style="background: #f7f7f5;">
          <th style="padding: 10px 14px; text-align: left; border-bottom: 2px solid #e0e0e0; font-weight: 600;">Task</th>
          <th style="padding: 10px 14px; text-align: left; border-bottom: 2px solid #e0e0e0; font-weight: 600;">Owner</th>
          <th style="padding: 10px 14px; text-align: left; border-bottom: 2px solid #e0e0e0; font-weight: 600;">Due Date</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Action item 1</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">—</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">—</td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Action item 2</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">—</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">—</td>
        </tr>
      </tbody>
    </table>
  `,
  project: `
    <h1 style="color: #37352f; font-family: Georgia, serif; font-size: 26px;">Project Brief</h1>
    <p style="color: #787774; font-size: 13px; border-bottom: 2px solid #37352f; padding-bottom: 10px;">
      Created ${today}
    </p>

    <h2 style="color: #37352f; font-family: Georgia, serif; margin-top: 28px; font-size: 20px;">📌 Overview</h2>
    <p style="color: #37352f; line-height: 1.7; font-size: 14px;">
      Describe the project goals, scope, and key objectives...
    </p>

    <h2 style="color: #37352f; font-family: Georgia, serif; margin-top: 28px; font-size: 20px;">📅 Timeline</h2>
    <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-top: 8px;">
      <thead>
        <tr style="background: #f7f7f5;">
          <th style="padding: 10px 14px; text-align: left; border-bottom: 2px solid #e0e0e0; font-weight: 600;">Phase</th>
          <th style="padding: 10px 14px; text-align: left; border-bottom: 2px solid #e0e0e0; font-weight: 600;">Duration</th>
          <th style="padding: 10px 14px; text-align: left; border-bottom: 2px solid #e0e0e0; font-weight: 600;">Status</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Research &amp; Planning</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">2 weeks</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;"><span style="background: #fff3e0; color: #e67e22; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">Not Started</span></td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Design</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">3 weeks</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;"><span style="background: #fff3e0; color: #e67e22; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">Not Started</span></td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Development</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">6 weeks</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;"><span style="background: #fff3e0; color: #e67e22; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">Not Started</span></td>
        </tr>
        <tr>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">Testing &amp; Launch</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;">2 weeks</td>
          <td style="padding: 10px 14px; border-bottom: 1px solid #e8e8e8;"><span style="background: #fff3e0; color: #e67e22; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600;">Not Started</span></td>
        </tr>
      </tbody>
    </table>

    <h2 style="color: #37352f; font-family: Georgia, serif; margin-top: 28px; font-size: 20px;">👥 Team</h2>
    <ul style="line-height: 1.8; color: #37352f; font-size: 14px; padding-left: 24px;">
      <li><strong>Project Lead:</strong> Name</li>
      <li><strong>Design:</strong> Name</li>
      <li><strong>Engineering:</strong> Name</li>
      <li><strong>QA:</strong> Name</li>
    </ul>

    <h2 style="color: #37352f; font-family: Georgia, serif; margin-top: 28px; font-size: 20px;">🔗 Resources</h2>
    <ul style="line-height: 1.8; color: #37352f; font-size: 14px; padding-left: 24px;">
      <li>Design files: <em>Link here</em></li>
      <li>Repository: <em>Link here</em></li>
      <li>Documentation: <em>Link here</em></li>
    </ul>
  `,
};

// ----------------------------------------------------------
// Helpers
// ----------------------------------------------------------

const generateId = () =>
  `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const formatRelativeTime = (timestamp: number) => {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
};

const loadDocsIndex = (): DocMeta[] => {
  try {
    const raw = localStorage.getItem(LS_DOCS_INDEX);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};

const saveDocsIndex = (docs: DocMeta[]) => {
  localStorage.setItem(LS_DOCS_INDEX, JSON.stringify(docs));
};

// ----------------------------------------------------------
// App Component
// ----------------------------------------------------------

function App() {
  // Document management state
  const [docs, setDocs] = useState<DocMeta[]>(loadDocsIndex);
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [view, setView] = useState<View>('home');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Editor state
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('saved');
  const lastSavedRef = useRef('');
  const canvasRef = useRef<DopeCanvasHandle>(null);

  // Formatting state & selection saver (from dopecanvas library)
  const fmt = useFormattingState();
  const { saveSelection, restoreAndExec } = useSelectionSaver();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Page break visibility toggle
  const [showPageBreaks, setShowPageBreaks] = useState(false);

  // Icon picker state for blank documents
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  // AI state
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiOutput, setAiOutput] = useState('');
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiEndpoint, setAiEndpoint] = useState(
    () => localStorage.getItem(LS_AI_ENDPOINT) || DEFAULT_AI_ENDPOINT
  );
  const [showAiSettings, setShowAiSettings] = useState(false);
  const aiAbortRef = useRef<AbortController | null>(null);
  const aiTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Persist docs index whenever it changes
  useEffect(() => {
    saveDocsIndex(docs);
  }, [docs]);

  // Sorted and filtered docs
  const sortedDocs = useMemo(() => {
    let filtered = [...docs].sort((a, b) => b.updatedAt - a.updatedAt);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.icon.includes(q)
      );
    }
    return filtered;
  }, [docs, searchQuery]);

  const recentDocs = useMemo(() => sortedDocs.slice(0, 5), [sortedDocs]);

  // ----------------------------------------------------------
  // Document CRUD
  // ----------------------------------------------------------

  const createDocument = useCallback(
    (templateId: string, customIcon?: string) => {
      const template = TEMPLATES.find((t) => t.id === templateId);
      if (!template) return;

      const id = generateId();
      const content = INLINE_TEMPLATES[templateId] || INLINE_TEMPLATES.blank;

      const newDoc: DocMeta = {
        id,
        title: template.id === 'blank' ? 'Untitled' : template.title,
        icon: customIcon || template.icon,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        templateId,
      };

      // Save content
      localStorage.setItem(LS_DOC_PREFIX + id, content);

      // Update index
      setDocs((prev) => [newDoc, ...prev]);

      // Open the document
      openDocument(id, content);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Handle icon selection for blank document
  const handleIconSelect = useCallback(
    (icon: string) => {
      setIconPickerOpen(false);
      createDocument('blank', icon);
    },
    [createDocument]
  );

  const openDocument = useCallback((id: string, preloadedHtml?: string) => {
    setLoading(true);
    setActiveDocId(id);

    const content =
      preloadedHtml || localStorage.getItem(LS_DOC_PREFIX + id) || '';
    setHtml(content);
    lastSavedRef.current = content;
    setSaveStatus('saved');
    setView('editor');

    // Small delay for smooth transition
    requestAnimationFrame(() => setLoading(false));
  }, []);

  const deleteDocument = useCallback(
    (id: string) => {
      localStorage.removeItem(LS_DOC_PREFIX + id);
      setDocs((prev) => prev.filter((d) => d.id !== id));
      if (activeDocId === id) {
        setActiveDocId(null);
        setView('home');
      }
    },
    [activeDocId]
  );

  const updateDocTitle = useCallback(
    (id: string, newTitle: string) => {
      setDocs((prev) =>
        prev.map((d) =>
          d.id === id ? { ...d, title: newTitle, updatedAt: Date.now() } : d
        )
      );
    },
    []
  );

  // ----------------------------------------------------------
  // Save (manual)
  // ----------------------------------------------------------

  const saveDocument = useCallback(() => {
    if (!canvasRef.current || !activeDocId) return;
    const currentHTML = canvasRef.current.getHTML();
    setSaveStatus('saving');
    try {
      localStorage.setItem(LS_DOC_PREFIX + activeDocId, currentHTML);
      lastSavedRef.current = currentHTML;
      setDocs((prev) =>
        prev.map((d) =>
          d.id === activeDocId ? { ...d, updatedAt: Date.now() } : d
        )
      );
      setSaveStatus('saved');
    } catch (err) {
      console.error('Failed to save:', err);
      setSaveStatus('unsaved');
    }
  }, [activeDocId]);

  const handleContentChange = useCallback(
    (_updatedHTML: string) => {
      setSaveStatus('unsaved');
    },
    []
  );

  // Keyboard shortcuts (Cmd/Ctrl+S to save)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (view === 'editor') saveDocument();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [saveDocument, view]);

  // ----------------------------------------------------------
  // Editor actions
  // ----------------------------------------------------------

  const handleExecCommand = useCallback((cmd: string, value?: string) => {
    canvasRef.current?.execCommand(cmd, value);
  }, []);

  const handleUndo = useCallback(() => {
    canvasRef.current?.undo();
  }, []);

  const handleRedo = useCallback(() => {
    canvasRef.current?.redo();
  }, []);

  const handleInsertLink = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const url = prompt('Enter URL:');
    if (url) canvasRef.current?.execCommand('createLink', url);
  }, []);

  const downloadDocument = useCallback(() => {
    if (!canvasRef.current || !activeDocId) return;
    const currentHTML = canvasRef.current.getHTML();
    const doc = docs.find((d) => d.id === activeDocId);
    const filename = `${doc?.title?.replace(/\s+/g, '-').toLowerCase() || 'document'}.html`;
    const blob = new Blob([currentHTML], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [activeDocId, docs]);

  const goHome = useCallback(() => {
    // Save before leaving
    if (canvasRef.current && activeDocId) {
      const currentHTML = canvasRef.current.getHTML();
      try {
        localStorage.setItem(LS_DOC_PREFIX + activeDocId, currentHTML);
        setDocs((prev) =>
          prev.map((d) =>
            d.id === activeDocId ? { ...d, updatedAt: Date.now() } : d
          )
        );
      } catch { /* ignore */ }
    }
    setActiveDocId(null);
    setView('home');
    setSearchQuery('');
  }, [activeDocId]);

  // ----------------------------------------------------------
  // AI generation
  // ----------------------------------------------------------

  const openAiModal = useCallback(() => {
    setAiModalOpen(true);
    setAiPrompt('');
    setAiOutput('');
    setAiError('');
    setShowAiSettings(false);
    setTimeout(() => aiTextareaRef.current?.focus(), 100);
  }, []);

  const closeAiModal = useCallback(() => {
    if (aiAbortRef.current) {
      aiAbortRef.current.abort();
      aiAbortRef.current = null;
    }
    setAiModalOpen(false);
    setAiGenerating(false);
  }, []);

  const updateAiEndpoint = useCallback((url: string) => {
    setAiEndpoint(url);
    localStorage.setItem(LS_AI_ENDPOINT, url);
  }, []);

  const generateAI = useCallback(async () => {
    if (!aiPrompt.trim()) return;

    setAiGenerating(true);
    setAiOutput('');
    setAiError('');

    const controller = new AbortController();
    aiAbortRef.current = controller;

    try {
      const response = await fetch(aiEndpoint + '/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: AI_SYSTEM_PROMPT },
            { role: 'user', content: aiPrompt },
          ],
          stream: true,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
            try {
              const data = JSON.parse(trimmed.slice(6));
              const content = data.choices?.[0]?.delta?.content;
              if (content) {
                accumulated += content;
                setAiOutput(accumulated);
              }
            } catch {
              // ignore partial JSON parse errors during streaming
            }
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setAiError(
          `Failed to connect to AI server at ${aiEndpoint}. Make sure llama.cpp is running.`
        );
      }
    } finally {
      setAiGenerating(false);
      aiAbortRef.current = null;
    }
  }, [aiPrompt, aiEndpoint]);

  const stopAiGeneration = useCallback(() => {
    if (aiAbortRef.current) {
      aiAbortRef.current.abort();
      aiAbortRef.current = null;
    }
    setAiGenerating(false);
  }, []);

  const createDocFromAI = useCallback(
    (content: string) => {
      const id = generateId();
      // Try to extract a title from the first heading
      const titleMatch = content.match(/<h1[^>]*>(.*?)<\/h1>/i);
      const extractedTitle = titleMatch
        ? titleMatch[1].replace(/<[^>]*>/g, '').trim()
        : 'AI Document';

      const newDoc: DocMeta = {
        id,
        title: extractedTitle,
        icon: '✨',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        templateId: 'ai',
      };

      localStorage.setItem(LS_DOC_PREFIX + id, content);
      setDocs((prev) => [newDoc, ...prev]);
      closeAiModal();
      openDocument(id, content);
    },
    [closeAiModal, openDocument]
  );

  const insertAiIntoDoc = useCallback(
    (content: string) => {
      if (!activeDocId) return;
      // Get current content and append AI content
      const currentHTML =
        canvasRef.current?.getHTML() ||
        localStorage.getItem(LS_DOC_PREFIX + activeDocId) ||
        '';
      const newHTML =
        currentHTML +
        '\n<div style="break-before: page;"></div>\n' +
        content;

      localStorage.setItem(LS_DOC_PREFIX + activeDocId, newHTML);
      setDocs((prev) =>
        prev.map((d) =>
          d.id === activeDocId ? { ...d, updatedAt: Date.now() } : d
        )
      );
      closeAiModal();
      // Reload document
      setHtml(newHTML);
      lastSavedRef.current = newHTML;
      setSaveStatus('saved');
      // Force re-render by toggling loading
      setLoading(true);
      requestAnimationFrame(() => setLoading(false));
    },
    [activeDocId, closeAiModal]
  );

  // Active document metadata
  const activeDoc = useMemo(
    () => docs.find((d) => d.id === activeDocId) || null,
    [docs, activeDocId]
  );

  // ----------------------------------------------------------
  // Render: Sidebar
  // ----------------------------------------------------------

  const renderSidebar = () => (
    <div style={sidebarCollapsed ? styles.sidebarCollapsed : styles.sidebar}>
      {sidebarCollapsed ? (
        <button
          onClick={() => setSidebarCollapsed(false)}
          style={styles.sidebarToggle}
          title="Expand sidebar"
        >
          ☰
        </button>
      ) : (
        <>
          {/* Workspace header */}
          <div style={styles.sidebarHeader}>
            <svg style={styles.workspaceLogo} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <rect x="5" y="5" width="90" height="90" rx="15" fill="white" stroke="#0a0a0a" strokeWidth="5" />
              <rect x="20" y="25" width="20" height="20" rx="4" fill="#0a0a0a" />
              <rect x="60" y="25" width="20" height="20" rx="4" fill="#0a0a0a" />
              <rect x="23" y="28" width="6" height="6" rx="1" fill="white" />
              <rect x="63" y="28" width="6" height="6" rx="1" fill="white" />
              <path d="M30 60 Q50 75 70 60" fill="none" stroke="#0a0a0a" strokeWidth="4" strokeLinecap="round" />
            </svg>
            <span style={styles.workspaceName}>DopeOffice</span>
            <button
              onClick={() => setSidebarCollapsed(true)}
              style={styles.sidebarToggle}
              title="Collapse sidebar"
            >
              ◀
            </button>
          </div>

          {/* Navigation */}
          <div style={styles.sidebarNav}>
            <button
              onClick={goHome}
              style={{
                ...styles.sidebarNavItem,
                ...(view === 'home' ? styles.sidebarNavItemActive : {}),
              }}
            >
              <span style={styles.navIcon}>🏠</span>
              Home
            </button>
            <button
              onClick={() => searchInputRef.current?.focus()}
              style={styles.sidebarNavItem}
            >
              <span style={styles.navIcon}>🔍</span>
              Search
            </button>
            <button
              onClick={openAiModal}
              style={styles.sidebarNavItem}
            >
              <span style={styles.navIcon}>✨</span>
              AI Writer
            </button>
          </div>

          {/* Search bar */}
          <div style={styles.sidebarSearchWrap}>
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.sidebarSearchInput}
            />
          </div>

          {/* Divider */}
          <div style={styles.sidebarDivider} />

          {/* Documents list */}
          <div style={styles.sidebarSection}>
            <div style={styles.sidebarSectionHeader}>
              <span>Documents</span>
              <button
                onClick={() => createDocument('blank')}
                style={styles.sidebarAddBtn}
                title="New page"
              >
                +
              </button>
            </div>
            <div style={styles.sidebarDocList}>
              {sortedDocs.length === 0 && (
                <div style={styles.sidebarEmpty}>
                  {searchQuery ? 'No results found' : 'No documents yet'}
                </div>
              )}
              {sortedDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="sidebar-doc-item"
                  onClick={() => openDocument(doc.id)}
                  style={{
                    ...styles.sidebarDocItem,
                    backgroundColor: activeDocId === doc.id
                      ? 'rgba(55, 53, 47, 0.08)'
                      : 'transparent',
                    fontWeight: activeDocId === doc.id ? 500 : 400,
                  }}
                >
                  <span style={styles.docItemIcon}>{doc.icon}</span>
                  <span style={styles.docItemTitle}>{doc.title}</span>
                  <button
                    className="sidebar-delete-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Delete "${doc.title}"? This cannot be undone.`)) {
                        deleteDocument(doc.id);
                      }
                    }}
                    style={styles.sidebarDeleteBtn}
                    title="Delete document"
                  >
                    🗑
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );

  // ----------------------------------------------------------
  // Render: Home View
  // ----------------------------------------------------------

  const renderHome = () => (
    <div style={styles.homeContainer}>
      <div style={styles.homeContent}>
        {/* Hero / Greeting */}
        <div style={styles.homeHero}>
          <h1 style={styles.homeGreeting}>{getGreeting()}</h1>
          <p style={styles.homeSubtitle}>
            {docs.length === 0
              ? 'Create your first document to get started'
              : `You have ${docs.length} document${docs.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {/* Templates Section */}
        <div style={styles.homeSection}>
          <h2 style={styles.homeSectionTitle}>Start with a template</h2>
          <div style={styles.templateGrid}>
            {/* AI Write card — special first card */}
            <button
              onClick={openAiModal}
              style={styles.templateCard}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.transform =
                  'translateY(-4px)';
                (e.currentTarget as HTMLElement).style.boxShadow =
                  '0 12px 40px rgba(0,0,0,0.12)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.transform =
                  'translateY(0)';
                (e.currentTarget as HTMLElement).style.boxShadow =
                  '0 1px 3px rgba(0,0,0,0.08)';
              }}
            >
              <div
                style={{
                  ...styles.templateCardCover,
                  background:
                    'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
                }}
              >
                <span style={{ ...styles.templateCardIcon, fontSize: 36 }}>
                  ✨
                </span>
              </div>
              <div style={styles.templateCardBody}>
                <div style={styles.templateCardTitle}>AI Writer</div>
                <div style={styles.templateCardDesc}>
                  Describe a document and let AI write it
                </div>
              </div>
            </button>
            {TEMPLATES.map((template) => (
              <button
                key={template.id}
                onClick={() =>
                  template.id === 'blank'
                    ? setIconPickerOpen(true)
                    : createDocument(template.id)
                }
                style={styles.templateCard}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.transform =
                    'translateY(-4px)';
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    '0 12px 40px rgba(0,0,0,0.12)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.transform =
                    'translateY(0)';
                  (e.currentTarget as HTMLElement).style.boxShadow =
                    '0 1px 3px rgba(0,0,0,0.08)';
                }}
              >
                <div
                  style={{
                    ...styles.templateCardCover,
                    background: template.gradient,
                  }}
                >
                  <span style={styles.templateCardIcon}>{template.icon}</span>
                </div>
                <div style={styles.templateCardBody}>
                  <div style={styles.templateCardTitle}>{template.title}</div>
                  <div style={styles.templateCardDesc}>
                    {template.description}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Documents */}
        {docs.length > 0 && (
          <div style={styles.homeSection}>
            <h2 style={styles.homeSectionTitle}>Recent documents</h2>
            <div style={styles.recentTable}>
              <div style={styles.recentTableHeader}>
                <span style={{ flex: 1 }}>Name</span>
                <span style={{ width: 120, textAlign: 'right' }}>
                  Last edited
                </span>
                <span style={{ width: 60, textAlign: 'center' }}>Actions</span>
              </div>
              {recentDocs.map((doc) => (
                <div
                  key={doc.id}
                  style={styles.recentTableRow}
                  onClick={() => openDocument(doc.id)}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      '#f7f7f5';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor =
                      'transparent';
                  }}
                >
                  <span style={styles.recentDocName}>
                    <span style={styles.recentDocIcon}>{doc.icon}</span>
                    {doc.title}
                  </span>
                  <span style={styles.recentDocTime}>
                    {formatRelativeTime(doc.updatedAt)}
                  </span>
                  <span style={styles.recentDocActions}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          confirm(
                            `Delete "${doc.title}"? This cannot be undone.`
                          )
                        ) {
                          deleteDocument(doc.id);
                        }
                      }}
                      style={styles.deleteBtn}
                      title="Delete document"
                    >
                      ×
                    </button>
                  </span>
                </div>
              ))}
            </div>

            {sortedDocs.length > 5 && (
              <div style={styles.viewAllWrap}>
                <span style={styles.viewAllText}>
                  Showing 5 of {sortedDocs.length} documents. Use search to
                  find more.
                </span>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {docs.length === 0 && (
          <div style={styles.emptyState}>
            <div style={styles.emptyStateIcon}>✨</div>
            <h3 style={styles.emptyStateTitle}>
              Your workspace is empty
            </h3>
            <p style={styles.emptyStateDesc}>
              Pick a template above or create a blank document to start building
              your workspace.
            </p>
            <button
              onClick={() => createDocument('blank')}
              style={styles.emptyStateCTA}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  '#2d2d42';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor =
                  '#37352f';
              }}
            >
              + New blank page
            </button>
          </div>
        )}
      </div>
    </div>
  );

  // ----------------------------------------------------------
  // Render: Editor View
  // ----------------------------------------------------------

  const renderEditor = () => {
    if (loading) {
      return (
        <div style={styles.loadingWrap}>
          <div style={styles.loadingText}>Loading document...</div>
        </div>
      );
    }

    return (
      <div style={styles.editorContainer}>
        {/* Editor top bar */}
        <div style={styles.editorTopBar}>
          <div style={styles.editorTopBarLeft}>
            <button onClick={goHome} style={styles.backBtn}>
              ← Home
            </button>
            {activeDoc && (
              <>
                <span style={styles.editorDocIcon}>{activeDoc.icon}</span>
                <input
                  type="text"
                  value={activeDoc.title}
                  onChange={(e) =>
                    updateDocTitle(activeDoc.id, e.target.value)
                  }
                  style={styles.editorTitleInput}
                  placeholder="Untitled"
                />
              </>
            )}
          </div>
          <div style={styles.editorTopBarRight}>
            <span style={styles.saveIndicator(saveStatus)}>
              {saveStatus === 'saved' && '✓ Saved'}
              {saveStatus === 'unsaved' && '○ Unsaved'}
              {saveStatus === 'saving' && '◌ Saving...'}
            </span>
            <button
              onClick={openAiModal}
              style={styles.topBarAiBtn}
              title="Generate content with AI"
            >
              ✨ AI
            </button>
            <button
              onClick={saveDocument}
              style={{
                ...styles.topBarActionBtn,
                ...(saveStatus === 'unsaved'
                  ? {
                      backgroundColor: '#37352f',
                      color: '#fff',
                      borderColor: '#37352f',
                    }
                  : {}),
              }}
              title="Save (Cmd+S)"
            >
              Save
            </button>
            <button
              onClick={downloadDocument}
              style={styles.topBarActionBtn}
              title="Download as HTML"
            >
              ↓ Export
            </button>
          </div>
        </div>

        {/* ====== Formatting Toolbar ====== */}
        <div style={styles.fmtToolbar}>
          {/* Undo / Redo */}
          <div style={styles.fmtGroup}>
            <button onClick={handleUndo} style={styles.fmtBtn} title="Undo (Ctrl+Z)">↩</button>
            <button onClick={handleRedo} style={styles.fmtBtn} title="Redo (Ctrl+Y)">↪</button>
          </div>
          <span style={styles.fmtDivider} />

          {/* Block format */}
          <select
            value={fmt.formatBlock}
            onChange={(e) => restoreAndExec(() => handleExecCommand('formatBlock', e.target.value))}
            onMouseDown={saveSelection}
            style={{ ...styles.fmtSelect, width: 100 }}
            title="Block Format"
          >
            <option value="p">Paragraph</option>
            <option value="h1">Heading 1</option>
            <option value="h2">Heading 2</option>
            <option value="h3">Heading 3</option>
            <option value="h4">Heading 4</option>
            <option value="h5">Heading 5</option>
            <option value="h6">Heading 6</option>
          </select>
          <span style={styles.fmtDivider} />

          {/* Font family */}
          <select
            value={fmt.fontName.replace(/['"]/g, '')}
            onChange={(e) => restoreAndExec(() => handleExecCommand('fontName', e.target.value))}
            onMouseDown={saveSelection}
            style={{ ...styles.fmtSelect, width: 110 }}
            title="Font Family"
          >
            <option value="Arial">Arial</option>
            <option value="Georgia">Georgia</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Courier New">Courier New</option>
            <option value="Verdana">Verdana</option>
            <option value="Trebuchet MS">Trebuchet MS</option>
            <option value="system-ui">System UI</option>
          </select>

          {/* Font size */}
          <select
            value={fmt.fontSize}
            onChange={(e) => restoreAndExec(() => handleExecCommand('fontSize', e.target.value))}
            onMouseDown={saveSelection}
            style={{ ...styles.fmtSelect, width: 52 }}
            title="Font Size"
          >
            <option value="1">8</option>
            <option value="2">10</option>
            <option value="3">12</option>
            <option value="4">14</option>
            <option value="5">18</option>
            <option value="6">24</option>
            <option value="7">36</option>
          </select>
          <span style={styles.fmtDivider} />

          {/* Bold / Italic / Underline / Strikethrough */}
          <button onMouseDown={(e) => { e.preventDefault(); handleExecCommand('bold'); }} style={{ ...styles.fmtBtn, fontWeight: 700, ...(fmt.bold ? styles.fmtBtnActive : {}) }} title="Bold (Ctrl+B)">B</button>
          <button onMouseDown={(e) => { e.preventDefault(); handleExecCommand('italic'); }} style={{ ...styles.fmtBtn, fontStyle: 'italic', ...(fmt.italic ? styles.fmtBtnActive : {}) }} title="Italic (Ctrl+I)">I</button>
          <button onMouseDown={(e) => { e.preventDefault(); handleExecCommand('underline'); }} style={{ ...styles.fmtBtn, textDecoration: 'underline', ...(fmt.underline ? styles.fmtBtnActive : {}) }} title="Underline (Ctrl+U)">U</button>
          <button onMouseDown={(e) => { e.preventDefault(); handleExecCommand('strikethrough'); }} style={{ ...styles.fmtBtn, textDecoration: 'line-through', ...(fmt.strikethrough ? styles.fmtBtnActive : {}) }} title="Strikethrough">S</button>

          {/* Superscript / Subscript */}
          <button onMouseDown={(e) => { e.preventDefault(); handleExecCommand('superscript'); }} style={{ ...styles.fmtBtn, fontSize: 10, ...(fmt.superscript ? styles.fmtBtnActive : {}) }} title="Superscript">x&#x00B2;</button>
          <button onMouseDown={(e) => { e.preventDefault(); handleExecCommand('subscript'); }} style={{ ...styles.fmtBtn, fontSize: 10, ...(fmt.subscript ? styles.fmtBtnActive : {}) }} title="Subscript">x&#x2082;</button>
          <span style={styles.fmtDivider} />

          {/* Text color */}
          <label style={styles.fmtColorLabel} title="Text Color" onMouseDown={saveSelection}>
            A
            <input type="color" defaultValue="#000000" onChange={(e) => restoreAndExec(() => handleExecCommand('foreColor', e.target.value))} style={styles.fmtColorInput} />
          </label>
          {/* Highlight color */}
          <label style={styles.fmtColorLabel} title="Highlight Color" onMouseDown={saveSelection}>
            <span style={{ backgroundColor: '#ffff00', padding: '0 2px', borderRadius: 2 }}>A</span>
            <input type="color" defaultValue="#ffff00" onChange={(e) => restoreAndExec(() => handleExecCommand('hiliteColor', e.target.value))} style={styles.fmtColorInput} />
          </label>
          <span style={styles.fmtDivider} />

          {/* Alignment */}
          <button onMouseDown={(e) => { e.preventDefault(); handleExecCommand('justifyLeft'); }} style={{ ...styles.fmtBtn, ...(fmt.justifyLeft ? styles.fmtBtnActive : {}) }} title="Align Left">&#x2261;</button>
          <button onMouseDown={(e) => { e.preventDefault(); handleExecCommand('justifyCenter'); }} style={{ ...styles.fmtBtn, ...(fmt.justifyCenter ? styles.fmtBtnActive : {}) }} title="Align Center">&#x2263;</button>
          <button onMouseDown={(e) => { e.preventDefault(); handleExecCommand('justifyRight'); }} style={{ ...styles.fmtBtn, ...(fmt.justifyRight ? styles.fmtBtnActive : {}) }} title="Align Right">&#x2262;</button>
          <button onMouseDown={(e) => { e.preventDefault(); handleExecCommand('justifyFull'); }} style={{ ...styles.fmtBtn, ...(fmt.justifyFull ? styles.fmtBtnActive : {}) }} title="Justify">&#x2630;</button>
          <span style={styles.fmtDivider} />

          {/* Lists */}
          <button onMouseDown={(e) => { e.preventDefault(); handleExecCommand('insertUnorderedList'); }} style={{ ...styles.fmtBtn, ...(fmt.unorderedList ? styles.fmtBtnActive : {}) }} title="Bullet List">&#x2022;</button>
          <button onMouseDown={(e) => { e.preventDefault(); handleExecCommand('insertOrderedList'); }} style={{ ...styles.fmtBtn, fontSize: 10, fontWeight: 600, ...(fmt.orderedList ? styles.fmtBtnActive : {}) }} title="Numbered List">1.</button>

          {/* Indent / Outdent */}
          <button onMouseDown={(e) => { e.preventDefault(); handleExecCommand('outdent'); }} style={styles.fmtBtn} title="Decrease Indent">&#x21E4;</button>
          <button onMouseDown={(e) => { e.preventDefault(); handleExecCommand('indent'); }} style={styles.fmtBtn} title="Increase Indent">&#x21E5;</button>
          <span style={styles.fmtDivider} />

          {/* Link / HR / Clear */}
          <button onMouseDown={handleInsertLink} style={styles.fmtBtn} title="Insert Link">&#x1F517;</button>
          <button onMouseDown={(e) => { e.preventDefault(); handleExecCommand('insertHorizontalRule'); }} style={styles.fmtBtn} title="Horizontal Rule">&mdash;</button>
          <button onMouseDown={(e) => { e.preventDefault(); handleExecCommand('removeFormat'); }} style={styles.fmtBtn} title="Clear Formatting">T&#x0338;</button>
          <span style={styles.fmtDivider} />

          {/* Page breaks */}
          <button
            onMouseDown={(e) => { e.preventDefault(); canvasRef.current?.insertPageBreak(); }}
            style={styles.fmtBtn}
            title="Insert Page Break"
          >
            ⏎
          </button>
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              const next = !showPageBreaks;
              setShowPageBreaks(next);
              canvasRef.current?.setShowPageBreaks(next);
            }}
            style={{ ...styles.fmtBtn, ...(showPageBreaks ? styles.fmtBtnActive : {}) }}
            title={showPageBreaks ? 'Hide Page Breaks' : 'Show Page Breaks'}
          >
            ¶
          </button>
        </div>

        {/* ====== Canvas ====== */}
        <div style={styles.editorCanvas}>
          <DopeCanvas
            ref={canvasRef}
            html={html}
            onContentChange={handleContentChange}
          />
        </div>

      </div>
    );
  };

  // ----------------------------------------------------------
  // Render: Icon Picker Modal
  // ----------------------------------------------------------

  const renderIconPicker = () => {
    if (!iconPickerOpen) return null;

    return (
      <div
        style={styles.aiOverlay}
        onClick={() => setIconPickerOpen(false)}
      >
        <div
          style={{
            ...styles.aiModal,
            maxWidth: 400,
            maxHeight: '80vh',
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={styles.aiModalHeader}>
            <div style={styles.aiModalTitleRow}>
              <span style={{ fontSize: 20 }}>📄</span>
              <h3 style={styles.aiModalTitle}>Choose an Icon</h3>
            </div>
            <button
              onClick={() => setIconPickerOpen(false)}
              style={styles.aiCloseBtn}
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div style={{ padding: 20 }}>
            <p style={{ margin: '0 0 16px', color: '#787774', fontSize: 13 }}>
              Select an icon for your new document
            </p>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(8, 1fr)',
                gap: 8,
              }}
            >
              {DOCUMENT_ICONS.map((icon) => (
                <button
                  key={icon}
                  onClick={() => handleIconSelect(icon)}
                  style={{
                    width: 40,
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    border: '1px solid #e8e8e5',
                    borderRadius: 8,
                    background: '#fff',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = '#f5f5f4';
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1.1)';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = '#fff';
                    (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                  }}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ----------------------------------------------------------
  // Render: AI Modal
  // ----------------------------------------------------------

  const renderAiModal = () => {
    if (!aiModalOpen) return null;

    return (
      <div style={styles.aiOverlay} onClick={closeAiModal}>
        <div style={styles.aiModal} onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div style={styles.aiModalHeader}>
            <div style={styles.aiModalTitleRow}>
              <span style={{ fontSize: 20 }}>✨</span>
              <h3 style={styles.aiModalTitle}>AI Document Writer</h3>
            </div>
            <div style={styles.aiModalHeaderActions}>
              <button
                onClick={() => setShowAiSettings(!showAiSettings)}
                style={styles.aiSettingsBtn}
                title="Settings"
              >
                ⚙
              </button>
              <button onClick={closeAiModal} style={styles.aiCloseBtn}>
                ✕
              </button>
            </div>
          </div>

          {/* Settings panel */}
          {showAiSettings && (
            <div style={styles.aiSettingsPanel}>
              <label style={styles.aiSettingsLabel}>
                LLM Server URL
              </label>
              <input
                type="text"
                value={aiEndpoint}
                onChange={(e) => updateAiEndpoint(e.target.value)}
                style={styles.aiSettingsInput}
                placeholder="http://127.0.0.1:8083"
              />
              <div style={styles.aiSettingsHint}>
                Compatible with llama.cpp, Ollama, LM Studio, or any
                OpenAI-compatible API
              </div>
            </div>
          )}

          {/* Body */}
          <div style={styles.aiModalBody}>
            {/* Prompt input */}
            <textarea
              ref={aiTextareaRef}
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (aiPrompt.trim() && !aiGenerating) generateAI();
                }
              }}
              placeholder={
                'Describe the document you want to create...\n\n' +
                'Examples:\n' +
                '• Write a product launch plan for a fitness app\n' +
                '• Create a weekly status report template for an engineering team\n' +
                '• Draft a project proposal for migrating to cloud infrastructure'
              }
              style={styles.aiTextarea}
            />

            {/* Action buttons */}
            <div style={styles.aiPromptActions}>
              {!aiGenerating ? (
                <button
                  onClick={generateAI}
                  disabled={!aiPrompt.trim()}
                  style={{
                    ...styles.aiGenerateBtn,
                    opacity: aiPrompt.trim() ? 1 : 0.5,
                    cursor: aiPrompt.trim() ? 'pointer' : 'not-allowed',
                  }}
                >
                  Generate Document
                </button>
              ) : (
                <button onClick={stopAiGeneration} style={styles.aiStopBtn}>
                  ■ Stop Generating
                </button>
              )}
              <span style={styles.aiShortcutHint}>⌘ + Enter</span>
            </div>

            {/* Error */}
            {aiError && <div style={styles.aiError}>{aiError}</div>}

            {/* Output preview */}
            {(aiOutput || aiGenerating) && (
              <div style={styles.aiPreviewSection}>
                <div style={styles.aiPreviewLabel}>
                  {aiGenerating ? (
                    <span>
                      Generating
                      <span style={styles.aiDots}>...</span>
                    </span>
                  ) : (
                    'Preview'
                  )}
                </div>
                <div
                  style={styles.aiPreview}
                  dangerouslySetInnerHTML={{
                    __html: aiOutput || '<p style="color:#b4b4b0;">Waiting for response...</p>',
                  }}
                />
              </div>
            )}
          </div>

          {/* Footer actions — show only when content is ready */}
          {aiOutput && !aiGenerating && (
            <div style={styles.aiModalFooter}>
              <button
                onClick={() => createDocFromAI(aiOutput)}
                style={styles.aiCreateBtn}
              >
                + Create New Document
              </button>
              {view === 'editor' && activeDocId && (
                <button
                  onClick={() => insertAiIntoDoc(aiOutput)}
                  style={styles.aiInsertBtn}
                >
                  ↳ Append to Current Document
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  // ----------------------------------------------------------
  // Main render
  // ----------------------------------------------------------

  return (
    <div style={styles.appContainer}>
      {renderSidebar()}
      <div style={styles.mainArea}>
        {view === 'home' ? renderHome() : renderEditor()}
      </div>
      {renderIconPicker()}
      {renderAiModal()}
    </div>
  );
}

// ----------------------------------------------------------
// Styles
// ----------------------------------------------------------

const styles = {
  // Layout
  appContainer: {
    height: '100vh',
    display: 'flex',
    overflow: 'hidden',
    backgroundColor: '#ffffff',
  } as React.CSSProperties,

  mainArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    minWidth: 0,
  } as React.CSSProperties,

  // Sidebar
  sidebar: {
    width: 240,
    backgroundColor: '#f7f7f5',
    borderRight: '1px solid #e8e8e5',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    position: 'relative',
    transition: 'width 0.2s ease',
  } as React.CSSProperties,

  sidebarCollapsed: {
    width: 44,
    backgroundColor: '#f7f7f5',
    borderRight: '1px solid #e8e8e5',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    position: 'relative',
    transition: 'width 0.2s ease',
    alignItems: 'center',
    paddingTop: 8,
  } as React.CSSProperties,

  sidebarToggle: {
    width: 28,
    height: 28,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    borderRadius: 4,
    fontSize: 13,
    color: '#787774',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    marginLeft: 'auto',
  } as React.CSSProperties,

  sidebarHeader: {
    padding: '16px 12px 8px',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  } as React.CSSProperties,

  workspaceLogo: {
    width: 22,
    height: 22,
    flexShrink: 0,
  } as React.CSSProperties,

  workspaceName: {
    fontSize: 14,
    fontWeight: 600,
    color: '#37352f',
    letterSpacing: '-0.01em',
  } as React.CSSProperties,

  sidebarNav: {
    padding: '8px 8px 4px',
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
  } as React.CSSProperties,

  sidebarNavItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 8px',
    border: 'none',
    backgroundColor: 'transparent',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    color: '#37352f',
    textAlign: 'left',
    width: '100%',
    transition: 'background-color 0.1s',
    outline: 'none',
    WebkitAppearance: 'none',
    appearance: 'none',
  } as React.CSSProperties,

  sidebarNavItemActive: {
    backgroundColor: 'rgba(55, 53, 47, 0.08)',
    fontWeight: 500,
  } as React.CSSProperties,

  navIcon: {
    fontSize: 15,
    width: 20,
    textAlign: 'center',
    flexShrink: 0,
  } as React.CSSProperties,

  sidebarSearchWrap: {
    padding: '4px 8px 8px',
  } as React.CSSProperties,

  sidebarSearchInput: {
    width: '100%',
    padding: '6px 10px',
    border: '1px solid #e0deda',
    borderRadius: 6,
    fontSize: 12,
    color: '#37352f',
    backgroundColor: '#fff',
    outline: 'none',
  } as React.CSSProperties,

  sidebarDivider: {
    height: 1,
    backgroundColor: '#e8e8e5',
    margin: '0 12px',
  } as React.CSSProperties,

  sidebarSection: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    paddingTop: 8,
  } as React.CSSProperties,

  sidebarSectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '4px 12px',
    fontSize: 11,
    fontWeight: 500,
    color: '#787774',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  } as React.CSSProperties,

  sidebarAddBtn: {
    width: 22,
    height: 22,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    borderRadius: 4,
    fontSize: 16,
    color: '#787774',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    lineHeight: 1,
  } as React.CSSProperties,

  sidebarDocList: {
    flex: 1,
    overflowY: 'auto',
    padding: '4px 8px 12px',
  } as React.CSSProperties,

  sidebarEmpty: {
    padding: '16px 8px',
    textAlign: 'center',
    fontSize: 12,
    color: '#b4b4b0',
  } as React.CSSProperties,

  sidebarDocItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '5px 8px',
    border: 'none',
    backgroundColor: 'transparent',
    borderRadius: 6,
    cursor: 'pointer',
    fontSize: 13,
    color: '#37352f',
    textAlign: 'left',
    width: '100%',
    transition: 'background-color 0.1s',
    overflow: 'hidden',
    outline: 'none',
    WebkitAppearance: 'none',
    appearance: 'none',
  } as React.CSSProperties,

  sidebarDocItemActive: {
    backgroundColor: 'rgba(55, 53, 47, 0.08)',
    fontWeight: 500,
  } as React.CSSProperties,

  docItemIcon: {
    fontSize: 14,
    flexShrink: 0,
  } as React.CSSProperties,

  docItemTitle: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    flex: 1,
  } as React.CSSProperties,

  sidebarDeleteBtn: {
    width: 20,
    height: 20,
    border: 'none',
    backgroundColor: 'transparent',
    cursor: 'pointer',
    borderRadius: 4,
    fontSize: 12,
    lineHeight: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    opacity: 0,
    transition: 'opacity 0.15s',
    outline: 'none',
    padding: 0,
  } as React.CSSProperties,

  // Home view
  homeContainer: {
    flex: 1,
    overflow: 'auto',
    backgroundColor: '#ffffff',
  } as React.CSSProperties,

  homeContent: {
    maxWidth: 900,
    margin: '0 auto',
    padding: '48px 40px 80px',
  } as React.CSSProperties,

  homeHero: {
    marginBottom: 40,
  } as React.CSSProperties,

  homeGreeting: {
    fontSize: 34,
    fontWeight: 700,
    color: '#37352f',
    letterSpacing: '-0.03em',
    margin: 0,
    lineHeight: 1.2,
  } as React.CSSProperties,

  homeSubtitle: {
    fontSize: 15,
    color: '#787774',
    marginTop: 8,
    lineHeight: 1.5,
  } as React.CSSProperties,

  homeSection: {
    marginBottom: 40,
  } as React.CSSProperties,

  homeSectionTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: '#37352f',
    marginBottom: 16,
    letterSpacing: '-0.01em',
  } as React.CSSProperties,

  // Template cards
  templateGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
    gap: 12,
  } as React.CSSProperties,

  templateCard: {
    border: '1px solid #e8e8e5',
    borderRadius: 10,
    overflow: 'hidden',
    cursor: 'pointer',
    textAlign: 'left',
    background: '#fff',
    boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
    padding: 0,
  } as React.CSSProperties,

  templateCardCover: {
    height: 80,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,

  templateCardIcon: {
    fontSize: 32,
    filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
  } as React.CSSProperties,

  templateCardBody: {
    padding: '10px 12px 12px',
  } as React.CSSProperties,

  templateCardTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: '#37352f',
    marginBottom: 2,
  } as React.CSSProperties,

  templateCardDesc: {
    fontSize: 11,
    color: '#787774',
    lineHeight: 1.4,
  } as React.CSSProperties,

  // Recent documents table
  recentTable: {
    borderRadius: 8,
    border: '1px solid #e8e8e5',
    overflow: 'hidden',
  } as React.CSSProperties,

  recentTableHeader: {
    display: 'flex',
    alignItems: 'center',
    padding: '8px 16px',
    backgroundColor: '#f7f7f5',
    borderBottom: '1px solid #e8e8e5',
    fontSize: 11,
    fontWeight: 500,
    color: '#787774',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
  } as React.CSSProperties,

  recentTableRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 16px',
    borderBottom: '1px solid #f0f0ed',
    cursor: 'pointer',
    transition: 'background-color 0.1s',
  } as React.CSSProperties,

  recentDocName: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 14,
    color: '#37352f',
    fontWeight: 400,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  } as React.CSSProperties,

  recentDocIcon: {
    fontSize: 16,
    flexShrink: 0,
  } as React.CSSProperties,

  recentDocTime: {
    width: 120,
    textAlign: 'right',
    fontSize: 12,
    color: '#b4b4b0',
  } as React.CSSProperties,

  recentDocActions: {
    width: 60,
    textAlign: 'center',
  } as React.CSSProperties,

  deleteBtn: {
    width: 24,
    height: 24,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    borderRadius: 4,
    fontSize: 18,
    color: '#b4b4b0',
    lineHeight: 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,

  viewAllWrap: {
    textAlign: 'center',
    padding: '12px 0',
  } as React.CSSProperties,

  viewAllText: {
    fontSize: 12,
    color: '#b4b4b0',
  } as React.CSSProperties,

  // Empty state
  emptyState: {
    textAlign: 'center',
    padding: '48px 20px',
    borderRadius: 12,
    backgroundColor: '#fafafa',
    border: '1px dashed #e0deda',
  } as React.CSSProperties,

  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  } as React.CSSProperties,

  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 600,
    color: '#37352f',
    margin: '0 0 8px',
  } as React.CSSProperties,

  emptyStateDesc: {
    fontSize: 14,
    color: '#787774',
    lineHeight: 1.6,
    maxWidth: 400,
    margin: '0 auto 20px',
  } as React.CSSProperties,

  emptyStateCTA: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 20px',
    border: 'none',
    borderRadius: 8,
    backgroundColor: '#37352f',
    color: '#fff',
    fontSize: 14,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  } as React.CSSProperties,

  // Editor view
  editorContainer: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  } as React.CSSProperties,

  editorTopBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 16px',
    borderBottom: '1px solid #e8e8e5',
    backgroundColor: '#fff',
    flexShrink: 0,
    minHeight: 44,
  } as React.CSSProperties,

  editorTopBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,

  editorTopBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0,
  } as React.CSSProperties,

  backBtn: {
    padding: '4px 10px',
    border: '1px solid #e0deda',
    borderRadius: 6,
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: 12,
    color: '#787774',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    flexShrink: 0,
  } as React.CSSProperties,

  editorDocIcon: {
    fontSize: 16,
    flexShrink: 0,
  } as React.CSSProperties,

  editorTitleInput: {
    border: 'none',
    outline: 'none',
    fontSize: 14,
    fontWeight: 500,
    color: '#37352f',
    backgroundColor: 'transparent',
    padding: '4px 2px',
    flex: 1,
    minWidth: 0,
  } as React.CSSProperties,

  saveIndicator: (status: SaveStatus): React.CSSProperties => ({
    fontSize: 12,
    fontWeight: 500,
    color:
      status === 'saved'
        ? '#4caf50'
        : status === 'saving'
          ? '#ff9800'
          : '#999',
    whiteSpace: 'nowrap',
  }),

  topBarAiBtn: {
    padding: '5px 12px',
    border: 'none',
    borderRadius: 6,
    background: 'linear-gradient(135deg, #302b63, #24243e)',
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
    transition: 'opacity 0.15s',
  } as React.CSSProperties,

  topBarActionBtn: {
    padding: '5px 12px',
    border: '1px solid #e0deda',
    borderRadius: 6,
    backgroundColor: '#fff',
    cursor: 'pointer',
    fontSize: 12,
    color: '#37352f',
    fontWeight: 500,
    whiteSpace: 'nowrap',
    flexShrink: 0,
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    transition: 'background-color 0.1s, border-color 0.1s',
  } as React.CSSProperties,

  editorCanvas: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  } as React.CSSProperties,

  // Formatting toolbar (above canvas)
  fmtToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    padding: '5px 12px',
    borderBottom: '1px solid #e8e8e5',
    backgroundColor: '#fafaf9',
    flexShrink: 0,
    flexWrap: 'wrap',
    minHeight: 38,
  } as React.CSSProperties,

  fmtGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
  } as React.CSSProperties,

  fmtBtn: {
    width: 28,
    height: 28,
    border: '1px solid transparent',
    borderRadius: 4,
    backgroundColor: 'transparent',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 13,
    color: '#37352f',
    padding: 0,
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    transition: 'background-color 0.1s, border-color 0.1s',
  } as React.CSSProperties,

  fmtBtnActive: {
    backgroundColor: '#e3e2df',
    borderColor: '#d0cfcc',
  } as React.CSSProperties,

  fmtSelect: {
    height: 28,
    border: '1px solid #e0deda',
    borderRadius: 4,
    fontSize: 12,
    padding: '0 4px',
    cursor: 'pointer',
    backgroundColor: '#fff',
    color: '#37352f',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  } as React.CSSProperties,

  fmtDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#e0deda',
    margin: '0 3px',
    flexShrink: 0,
  } as React.CSSProperties,

  fmtColorLabel: {
    position: 'relative',
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 'bold' as const,
    color: '#37352f',
  } as React.CSSProperties,

  fmtColorInput: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: '100%',
    height: 4,
    padding: 0,
    border: 'none',
    cursor: 'pointer',
  } as React.CSSProperties,

  toolbarDivider: {
    width: 1,
    height: 18,
    backgroundColor: '#e0deda',
    margin: '0 4px',
  } as React.CSSProperties,

  // AI Modal
  aiOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    backdropFilter: 'blur(4px)',
  } as React.CSSProperties,

  aiModal: {
    width: '90%',
    maxWidth: 720,
    maxHeight: '85vh',
    backgroundColor: '#fff',
    borderRadius: 14,
    boxShadow: '0 24px 80px rgba(0,0,0,0.25)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  } as React.CSSProperties,

  aiModalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #e8e8e5',
    flexShrink: 0,
  } as React.CSSProperties,

  aiModalTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  } as React.CSSProperties,

  aiModalTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#37352f',
    margin: 0,
  } as React.CSSProperties,

  aiModalHeaderActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  } as React.CSSProperties,

  aiSettingsBtn: {
    width: 30,
    height: 30,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    borderRadius: 6,
    fontSize: 15,
    color: '#787774',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,

  aiCloseBtn: {
    width: 30,
    height: 30,
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    borderRadius: 6,
    fontSize: 16,
    color: '#787774',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,

  aiSettingsPanel: {
    padding: '12px 20px',
    backgroundColor: '#f7f7f5',
    borderBottom: '1px solid #e8e8e5',
    flexShrink: 0,
  } as React.CSSProperties,

  aiSettingsLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#787774',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    display: 'block',
    marginBottom: 6,
  } as React.CSSProperties,

  aiSettingsInput: {
    width: '100%',
    padding: '8px 12px',
    border: '1px solid #e0deda',
    borderRadius: 6,
    fontSize: 13,
    color: '#37352f',
    backgroundColor: '#fff',
    outline: 'none',
    fontFamily: 'monospace',
  } as React.CSSProperties,

  aiSettingsHint: {
    fontSize: 11,
    color: '#b4b4b0',
    marginTop: 6,
    lineHeight: 1.4,
  } as React.CSSProperties,

  aiModalBody: {
    flex: 1,
    overflow: 'auto',
    padding: '16px 20px',
  } as React.CSSProperties,

  aiTextarea: {
    width: '100%',
    minHeight: 120,
    padding: '12px 14px',
    border: '1px solid #e0deda',
    borderRadius: 10,
    fontSize: 14,
    color: '#37352f',
    backgroundColor: '#fafafa',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
    lineHeight: 1.6,
  } as React.CSSProperties,

  aiPromptActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginTop: 12,
  } as React.CSSProperties,

  aiGenerateBtn: {
    padding: '8px 20px',
    border: 'none',
    borderRadius: 8,
    background: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  } as React.CSSProperties,

  aiStopBtn: {
    padding: '8px 20px',
    border: '1px solid #e0deda',
    borderRadius: 8,
    backgroundColor: '#fff',
    color: '#c0392b',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  } as React.CSSProperties,

  aiShortcutHint: {
    fontSize: 11,
    color: '#b4b4b0',
    fontFamily: 'system-ui, sans-serif',
  } as React.CSSProperties,

  aiError: {
    marginTop: 12,
    padding: '10px 14px',
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#991b1b',
    fontSize: 13,
    lineHeight: 1.5,
  } as React.CSSProperties,

  aiPreviewSection: {
    marginTop: 16,
  } as React.CSSProperties,

  aiPreviewLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: '#787774',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 8,
  } as React.CSSProperties,

  aiDots: {
    display: 'inline-block',
    animation: 'none',
    letterSpacing: 2,
  } as React.CSSProperties,

  aiPreview: {
    padding: '16px 20px',
    border: '1px solid #e8e8e5',
    borderRadius: 10,
    backgroundColor: '#fff',
    maxHeight: 320,
    overflow: 'auto',
    fontSize: 14,
    lineHeight: 1.6,
    color: '#333',
  } as React.CSSProperties,

  aiModalFooter: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '14px 20px',
    borderTop: '1px solid #e8e8e5',
    backgroundColor: '#f7f7f5',
    flexShrink: 0,
  } as React.CSSProperties,

  aiCreateBtn: {
    padding: '8px 18px',
    border: 'none',
    borderRadius: 8,
    backgroundColor: '#37352f',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  } as React.CSSProperties,

  aiInsertBtn: {
    padding: '8px 18px',
    border: '1px solid #e0deda',
    borderRadius: 8,
    backgroundColor: '#fff',
    color: '#37352f',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 0.15s',
  } as React.CSSProperties,

  // Loading
  loadingWrap: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fafafa',
  } as React.CSSProperties,

  loadingText: {
    fontSize: 15,
    color: '#787774',
  } as React.CSSProperties,
};

export default App;
