/* ========================================
   1. Configuration and state
======================================== */

let pageSize = 25;

let entries = [];
let currentView = "table";
let currentPage = 1;
let searchTerm = "";
let sortColumn = "date";
let sortDirection = "desc";
let treeSortDirection = "desc";

let showMonth = true;
let showWeek = true;

// Tracks collapsed tree groups independently
const collapsedGroups = new Set();

/* ========================================
   ROW SELECTION STATE
======================================== */

let selectedEntries = new Set();

const selectAllCheckbox = document.getElementById("selectAllCheckbox");
const bulkToolbar = document.getElementById("bulkToolbar");
const selectionCount = document.getElementById("selectionCount");

const clearSelectionBtn = document.getElementById("clearSelectionBtn");
const exportSelectedBtn = document.getElementById("exportSelectedBtn");
const deleteSelectedBtn = document.getElementById("deleteSelectedBtn");

/* ========================================
   6. DOM references
======================================== */

const tableView = document.getElementById("tableView");
const treeView = document.getElementById("treeView");
const tableBody = document.getElementById("tableBody");

const columnsDropdown = document.getElementById("columnsDropdown");

const tableViewBtn = document.getElementById("tableViewBtn");
const treeViewBtn = document.getElementById("treeViewBtn");

const searchInput = document.getElementById("searchInput");
const clearSearchBtn = document.getElementById("clearSearch");

const expandAllBtn = document.getElementById("expandAllBtn");
const collapseAllBtn = document.getElementById("collapseAllBtn");

const treeLevelControls = document.getElementById("treeLevelControls");

const emptyState = document.getElementById("emptyState");

const recordCount = document.getElementById("recordCount");
const headerCount = document.getElementById("headerCount");

const pagination = document.getElementById("pagination");

/* ========================================
   UPDATE SELECTION UI
======================================== */

function updateSelectionUI() {

  const count = selectedEntries.size;

  selectionCount.textContent = `${count} selected`;

  bulkToolbar.hidden = count === 0;

  // Current page entries
  const filtered = getFilteredEntries();

  const totalPages = Math.ceil(filtered.length / pageSize);

  const safePage = Math.min(currentPage, Math.max(1, totalPages));

  const pageEntries = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const selectedOnPage = pageEntries.filter(entry =>
    selectedEntries.has(String(entry.reference))
  ).length;

  selectAllCheckbox.checked =
    pageEntries.length > 0 &&
    selectedOnPage === pageEntries.length;

  selectAllCheckbox.indeterminate =
    selectedOnPage > 0 &&
    selectedOnPage < pageEntries.length;

}

/* ========================================
   INDIVIDUAL ROW SELECTION
======================================== */

tableBody.addEventListener("change", event => {

  if (!event.target.classList.contains("row-checkbox")) {
    return;
  }

  const id = event.target.dataset.entryId;

  if (event.target.checked) {
    selectedEntries.add(id);
  } else {
    selectedEntries.delete(id);
  }

  updateSelectionUI();

});


/* ========================================
   SELECT ALL - CURRENT PAGE
======================================== */

selectAllCheckbox.addEventListener("click", event => {
  event.stopPropagation();
});

selectAllCheckbox.addEventListener("change", () => {

  const filtered = getFilteredEntries();

  const start = (currentPage - 1) * pageSize;

  const pageEntries = filtered.slice(
    start,
    start + pageSize
  );

  pageEntries.forEach(entry => {

    const id = String(entry.reference);

    if (selectAllCheckbox.checked) {
      selectedEntries.add(id);
    } else {
      selectedEntries.delete(id);
    }

  });

  renderTable();

});


/* ========================================
   CLEAR SELECTION
======================================== */

clearSelectionBtn.addEventListener("click", () => {

  selectedEntries.clear();

  renderTable();

});

/* ========================================
   EXPORT SELECTED ENTRIES
======================================== */

exportSelectedBtn.addEventListener("click", () => {

  const selected = entries.filter(entry =>
    selectedEntries.has(String(entry.reference))
  );

  if (selected.length === 0) return;

  const headers = [
    "Name",
    "Date",
    "Category",
    "Amount",
    "Status",
    "Reference"
  ];

  const rows = selected.map(entry => [
    entry.name,
    entry.date,
    entry.category,
    entry.amount,
    entry.status,
    entry.reference
  ]);

  function escapeCSV(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  const csv = [
    headers,
    ...rows
  ].map(row => row.map(escapeCSV).join(",")).join("\r\n");

  const blob = new Blob(
    ["\uFEFF" + csv],
    { type: "text/csv;charset=utf-8;" }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = "selected-entries.csv";

  link.click();

  URL.revokeObjectURL(url);

});

/* ========================================
   DELETE SELECTED ENTRIES
======================================== */

deleteSelectedBtn.addEventListener("click", () => {

  const count = selectedEntries.size;

  if (count === 0) return;

  const confirmed = confirm(
    `Are you sure you want to delete ${count} selected sorties?`
  );

  if (!confirmed) return;

  // Remove selected entries
  for (let i = entries.length - 1; i >= 0; i--) {

    if (selectedEntries.has(String(entries[i].reference))) {
      entries.splice(i, 1);
    }

  }

  // Clear selection
  selectedEntries.clear();

  // Refresh the current view
  currentPage = 1;

  if (currentView === "tree") {
    renderTree();
  } else {
    renderTable();
  }

  updateSelectionUI();

  // Update total count
  updateCounts(entries.length);

});

/* ========================================
   ADVANCED FILTERING
======================================== */

const filtersBtn = document.getElementById("filtersBtn");
const filtersMenu = document.getElementById("filtersMenu");
const filterBadge = document.getElementById("filterBadge");

const filterDateFrom = document.getElementById("filterDateFrom");
const filterDateTo = document.getElementById("filterDateTo");
const filterCategory = document.getElementById("filterCategory");
const filterStatus = document.getElementById("filterStatus");

const clearFiltersBtn = document.getElementById("clearFiltersBtn");

// Current filter values
let activeFilters = {
  dateFrom: "",
  dateTo: "",
  category: "",
  status: ""
};


/* ========================================
   POPULATE FILTER OPTIONS
======================================== */

function populateFilterOptions() {

  const categories = [...new Set(
    entries.map(entry => entry.category)
  )].sort();

  const statuses = [...new Set(
    entries.map(entry => entry.status)
  )].sort();

  categories.forEach(category => {
    const option = document.createElement("option");

    option.value = category;
    option.textContent = category;

    filterCategory.appendChild(option);
  });

  statuses.forEach(status => {
    const option = document.createElement("option");

    option.value = status;
    option.textContent = status;

    filterStatus.appendChild(option);
  });
}


/* ========================================
   UPDATE FILTER INDICATOR
======================================== */

function updateFilterBadge() {

  const count = Object.values(activeFilters)
    .filter(value => value !== "").length;

  filterBadge.textContent = count;
  filterBadge.hidden = count === 0;
}

/* ========================================
   ACTIVE FILTER PILLS
======================================== */

function renderActiveFilterPills() {

  const container = document.getElementById(
    "activeFilterPills"
  );

  container.innerHTML = "";

  const pills = [];

  if (activeFilters.dateFrom) {
    pills.push({
      key: "dateFrom",
      label: `From: ${activeFilters.dateFrom}`
    });
  }

  if (activeFilters.dateTo) {
    pills.push({
      key: "dateTo",
      label: `To: ${activeFilters.dateTo}`
    });
  }

  if (activeFilters.category) {
    pills.push({
      key: "category",
      label: `Category: ${activeFilters.category}`
    });
  }

  if (activeFilters.status) {
    pills.push({
      key: "status",
      label: `Status: ${activeFilters.status}`
    });
  }

  container.hidden = pills.length === 0;

  pills.forEach(pill => {

    const chip = document.createElement("div");
    chip.className = "filter-chip";

    const label = document.createElement("span");
    label.textContent = pill.label;

    const remove = document.createElement("button");
    remove.type = "button";
    remove.title = "Remove filter";
    remove.setAttribute(
      "aria-label",
      `Remove ${pill.label} filter`
    );

    const icon = document.createElement("i");
    icon.classList.add("fas", "fa-times");
    remove.appendChild(icon);

    remove.addEventListener("click", () => {

      activeFilters[pill.key] = "";

      // Update corresponding dropdown/input
      const inputs = {
        dateFrom: filterDateFrom,
        dateTo: filterDateTo,
        category: filterCategory,
        status: filterStatus
      };

      inputs[pill.key].value = "";

      applyFilters();

    });

    chip.appendChild(label);
    chip.appendChild(remove);

    container.appendChild(chip);

  });

}

/* ========================================
   FILTER EVENT HANDLERS
======================================== */

function applyFilters() {

  activeFilters.dateFrom = filterDateFrom.value;
  activeFilters.dateTo = filterDateTo.value;
  activeFilters.category = filterCategory.value;
  activeFilters.status = filterStatus.value;

  currentPage = 1;

  updateFilterBadge();
  renderActiveFilterPills();

  // Refresh the currently selected view
  if (currentView === "tree") {
    renderTree();
  } else {
    renderTable();
  }
}


// Apply filters immediately when changed
[
  filterDateFrom,
  filterDateTo,
  filterCategory,
  filterStatus
].forEach(input => {

  input.addEventListener("change", applyFilters);

});


/* ========================================
   FILTER MENU OPEN / CLOSE
======================================== */

filtersBtn.addEventListener("click", event => {

  event.stopPropagation();

  filtersMenu.hidden = !filtersMenu.hidden;

  filtersBtn.setAttribute(
    "aria-expanded",
    String(!filtersMenu.hidden)
  );

});


// Close menu when clicking outside
document.addEventListener("click", event => {

  if (!document.getElementById("filtersDropdown").contains(event.target)) {

    filtersMenu.hidden = true;

    filtersBtn.setAttribute(
      "aria-expanded",
      "false"
    );

  }

});


/* ========================================
   CLEAR ALL FILTERS
======================================== */

clearFiltersBtn.addEventListener("click", () => {

  filterDateFrom.value = "";
  filterDateTo.value = "";
  filterCategory.value = "";
  filterStatus.value = "";

  applyFilters();

});

// THeme
const themeToggle = document.getElementById("themeToggle");
const themeIcon = document.getElementById("themeIcon");
const themeLabel = document.getElementById("themeLabel");
const pageSizeSelect = document.getElementById("pageSizeSelect");
const paginationControls = document.getElementById("paginationControls");
const monthToggle = document.getElementById("monthToggle");
const weekToggle = document.getElementById("weekToggle");

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;

  const isDark = theme === "dark";

  themeIcon.textContent = isDark ? "☀" : "☾";
  themeLabel.textContent = isDark ? "Light mode" : "Dark mode";

  themeToggle.setAttribute(
    "aria-label",
    isDark ? "Switch to light mode" : "Switch to dark mode"
  );

  localStorage.setItem("entryExplorerTheme", theme);
}

themeToggle.addEventListener("click", () => {
  const currentTheme = document.documentElement.dataset.theme;

  applyTheme(currentTheme === "dark" ? "light" : "dark");
});

// Restore saved preference
const savedTheme = localStorage.getItem("entryExplorerTheme") || "light";

applyTheme(savedTheme);

/* ========================================
   2. Random data generation
======================================== */

const firstNames = [
  "Alice", "Bob", "Charlie", "Diana",
  "Edward", "Fiona", "George", "Hannah",
  "Ivan", "Julia", "Kevin", "Laura",
  "Michael", "Nina", "Oliver", "Peter",
  "Rachel", "Samuel", "Thomas", "Victoria"
];

const lastNames = [
  "Andersson", "Smith", "Johnson", "Brown",
  "Wilson", "Taylor", "Martin", "Clark",
  "Lewis", "Walker", "Hall", "Young",
  "King", "Wright", "Scott", "Green"
];

const categories = [
  "Sales", "Marketing", "Finance",
  "Operations", "Development", "Support"
];

const statuses = [
  "Active", "Pending", "Inactive"
];

function randomItem(array) {
  return array[Math.floor(Math.random() * array.length)];
}

function randomNumber(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate() {
  const start = new Date(2023, 0, 1).getTime();
  const end = new Date(2026, 11, 31).getTime();

  return new Date(randomNumber(start, end));
}

/* ========================================
   3. Date formatting and entry generation
======================================== */

function formatDate(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function generateEntries(count = 200) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    name: `${randomItem(firstNames)} ${randomItem(lastNames)}`,
    date: randomDate(),
    category: randomItem(categories),
    amount: randomNumber(100, 15000),
    status: randomItem(statuses),
    reference: `REF-${String(index + 1).padStart(5, "0")}`
  }));
}


/* ========================================
   4. ISO week calculations
======================================== */

function getISOWeekInfo(date) {
  const d = new Date(Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  ));

  // ISO weeks start on Monday
  const day = d.getUTCDay() || 7;

  // Move to Thursday of this ISO week
  d.setUTCDate(d.getUTCDate() + 4 - day);

  const isoYear = d.getUTCFullYear();

  const yearStart = new Date(Date.UTC(isoYear, 0, 1));

  const week = Math.ceil(
    (((d - yearStart) / 86400000) + 1) / 7
  );

  return {
    year: isoYear,
    week
  };
}

function getYearMonthWeek(date) {
  const iso = getISOWeekInfo(date);

  return {
    year: iso.year,
    month: date.getMonth(),
    week: iso.week
  };
}

/* ========================================
   5. Month names
======================================== */

const monthNames = [
  "January", "February", "March", "April",
  "May", "June", "July", "August",
  "September", "October", "November", "December"
];


/* ========================================
   COLUMN VISIBILITY
======================================== */

const columnsBtn = document.getElementById("columnsBtn");
const columnsMenu = document.getElementById("columnsMenu");
const resetColumnsBtn = document.getElementById("resetColumnsBtn");

const columnCheckboxes = document.querySelectorAll(
  ".column-option input[data-column]"
);

const DEFAULT_COLUMNS = [
  "name",
  "date",
  "category",
  "amount",
  "status",
  "reference"
];

let visibleColumns = [...DEFAULT_COLUMNS];

// Restore saved column preferences
try {
  const savedColumns = JSON.parse(
    localStorage.getItem("entryExplorerColumns")
  );

  if (Array.isArray(savedColumns)) {
    visibleColumns = DEFAULT_COLUMNS.filter(
      column => savedColumns.includes(column)
    );
  }
} catch (error) {
  visibleColumns = [...DEFAULT_COLUMNS];
}

// Always keep at least one column visible
if (visibleColumns.length === 0) {
  visibleColumns = [...DEFAULT_COLUMNS];
}


/* Apply visibility to table headers and cells */

function applyColumnVisibility() {
  document.querySelectorAll(
    ".data-table [data-column]"
  ).forEach(element => {

    const column = element.dataset.column;

    element.hidden = !visibleColumns.includes(column);

  });

  columnCheckboxes.forEach(checkbox => {
    checkbox.checked = visibleColumns.includes(
      checkbox.dataset.column
    );
  });

  localStorage.setItem(
    "entryExplorerColumns",
    JSON.stringify(visibleColumns)
  );
}


/* Handle checkbox changes */

columnCheckboxes.forEach(checkbox => {

  checkbox.addEventListener("change", () => {

    const column = checkbox.dataset.column;

    if (checkbox.checked) {
      if (!visibleColumns.includes(column)) {
        visibleColumns.push(column);
      }
    } else {

      if (visibleColumns.length === 1) {
        checkbox.checked = true;
        return;
      }

      visibleColumns = visibleColumns.filter(
        item => item !== column
      );
    }

    applyColumnVisibility();

  });

});


/* Reset columns */

resetColumnsBtn.addEventListener("click", () => {

  visibleColumns = [...DEFAULT_COLUMNS];

  applyColumnVisibility();

});

/* ========================================
   COLUMN MENU OPEN / CLOSE
======================================== */

columnsBtn.addEventListener("click", event => {

  event.stopPropagation();

  columnsMenu.hidden = !columnsMenu.hidden;

  columnsBtn.setAttribute(
    "aria-expanded",
    String(!columnsMenu.hidden)
  );

});


// Close menu when clicking outside
document.addEventListener("click", event => {

  if (!document.getElementById("columnsDropdown").contains(event.target)) {

    columnsMenu.hidden = true;

    columnsBtn.setAttribute(
      "aria-expanded",
      "false"
    );

  }

});


/* ========================================
   7. Filtering and sorting
======================================== */

function getFilteredEntries() {

  let result = [...entries];

  // Search filter
  if (searchTerm) {

    const search = searchTerm.toLowerCase();

    result = result.filter(entry => {

      return Object.values(entry).some(value =>
        String(value).toLowerCase().includes(search)
      );

    });

  }


  // Date from
  if (activeFilters.dateFrom) {

    result = result.filter(entry =>
      entry.date >= activeFilters.dateFrom
    );

  }


  // Date to (inclusive)
  if (activeFilters.dateTo) {

    result = result.filter(entry =>
      entry.date <= activeFilters.dateTo
    );

  }


  // Category
  if (activeFilters.category) {

    result = result.filter(entry =>
      entry.category === activeFilters.category
    );

  }


  // Status
  if (activeFilters.status) {

    result = result.filter(entry =>
      entry.status === activeFilters.status
    );

  }


  // Sorting
  result.sort((a, b) => {

    let valueA = a[sortColumn];
    let valueB = b[sortColumn];

    if (valueA instanceof Date) {
      valueA = valueA.getTime();
      valueB = valueB.getTime();
    }

    if (typeof valueA === "string") {
      valueA = valueA.toLowerCase();
      valueB = valueB.toLowerCase();
    }

    if (valueA < valueB) {
      return sortDirection === "asc" ? -1 : 1;
    }

    if (valueA > valueB) {
      return sortDirection === "asc" ? 1 : -1;
    }

    return 0;

  });

  return result;

}

/* ========================================
   8. Table rendering
======================================== */

function renderTable() {
  const filtered = getFilteredEntries();

  const totalPages = Math.max(
    1,
    Math.ceil(filtered.length / pageSize)
  );

  currentPage = Math.min(currentPage, totalPages);

  const start = (currentPage - 1) * pageSize;

  const pageEntries = filtered.slice(
    start,
    start + pageSize
  );

tableBody.innerHTML = pageEntries.map(entry => `
  <tr>
  <td class="selection-column">
  <input
    type="checkbox"
    class="row-checkbox"
    data-entry-id="${escapeHTML(String(entry.reference))}"
    aria-label="Select ${escapeHTML(entry.name)}"
    ${selectedEntries.has(String(entry.reference)) ? "checked" : ""}
  >
</td>
    <td data-column="name" class="name-cell">
      ${escapeHTML(entry.name)}
    </td>

    <td data-column="date" class="date-cell">
      ${formatDate(entry.date)}
    </td>

    <td data-column="category">
      ${escapeHTML(entry.category)}
    </td>

    <td data-column="amount">
      ${entry.amount.toLocaleString("en-US")}
    </td>

    <td data-column="status">
      <span class="status status-${entry.status.toLowerCase()}">
        ${escapeHTML(entry.status)}
      </span>
    </td>

    <td data-column="reference" class="muted">
      ${escapeHTML(entry.reference)}
    </td>
  </tr>
`).join("");

// Apply saved column visibility after rendering
applyColumnVisibility();
updateSelectionUI();

  renderPagination(filtered.length, totalPages);

  updateCounts(filtered.length);

  updateEmptyState(filtered.length);
}

/* ========================================
   9. Build tree data structure
======================================== */

function buildTree(data) {
  const tree = new Map();

  data.forEach(entry => {
    const { year, month, week } = getYearMonthWeek(entry.date);

    if (!tree.has(year)) {
      tree.set(year, new Map());
    }

    const months = tree.get(year);

    if (!months.has(month)) {
      months.set(month, new Map());
    }

    const weeks = months.get(month);

    if (!weeks.has(week)) {
      weeks.set(week, []);
    }

    weeks.get(week).push(entry);
  });

  return tree;
}


/* ========================================
   10. Create tree group
======================================== */

function createGroup({
  key,
  title,
  count,
  level,
  children
}) {
  const collapsed = collapsedGroups.has(key);

  const group = document.createElement("div");

  group.className =
    `tree-group${collapsed ? " collapsed" : ""}`;

  group.dataset.groupKey = key;

  const heading = document.createElement("div");

  heading.className = `tree-heading ${level}`;

  heading.innerHTML = `
    <i class="fas fa-caret-down"></i>
    <span class="group-title">${escapeHTML(title)}</span>
    <span class="group-count">${count}</span>
  `;

  heading.setAttribute("role", "button");
  heading.setAttribute("tabindex", "0");
  heading.setAttribute(
    "aria-expanded",
    String(!collapsed)
  );

  const content = document.createElement("div");

  content.className = "tree-content";
  content.appendChild(children);

   heading.addEventListener("click", () => {
    toggleGroup(key, group, heading);
  });

  heading.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleGroup(key, group, heading);
    }
  });

  group.appendChild(heading);
  group.appendChild(content);

  return group;
}


/* ========================================
   11. Toggle individual groups
======================================== */

function toggleGroup(key, group, heading) {
  const isCollapsed = group.classList.toggle("collapsed");

  if (isCollapsed) {
    collapsedGroups.add(key);
  } else {
    collapsedGroups.delete(key);
  }

  heading.setAttribute(
    "aria-expanded",
    String(!isCollapsed)
  );
}


/* ========================================
   12. Render tree entries
======================================== */

function renderTreeEntries(entriesForWeek) {
  const container = document.createElement("div");

  container.className = "tree-entries";

  entriesForWeek
    .sort((a, b) =>
      treeSortDirection === "desc"
        ? b.date - a.date
        : a.date - b.date
    )
    .forEach(entry => {
      const row = document.createElement("div");

      row.className = "tree-entry";

      row.innerHTML = `
        <span class="entry-name">
          ${escapeHTML(entry.name)}
        </span>

        <span class="entry-date">
          ${formatDate(entry.date)}
        </span>

        <span>${escapeHTML(entry.category)}</span>

        <span>${entry.amount.toLocaleString("en-US")}</span>
      `;

      container.appendChild(row);
    });

  return container;
}

/* ========================================
   FULL TREE RENDERER WITH OPTIONAL LEVELS
======================================== */

function renderTree() {
  const filtered = getFilteredEntries();
  const tree = buildTree(filtered);

  treeView.innerHTML = "";

  const sortedYears = [...tree.keys()].sort((a, b) =>
    treeSortDirection === "desc" ? b - a : a - b
  );

  sortedYears.forEach(year => {
    const months = tree.get(year);

    const yearContainer = document.createElement("div");

    // Sort months
    const sortedMonths = [...months.keys()].sort((a, b) =>
      treeSortDirection === "desc" ? b - a : a - b
    );

    sortedMonths.forEach(month => {
      const weeks = months.get(month);

      const monthContainer = document.createElement("div");

      // Sort weeks
      const sortedWeeks = [...weeks.keys()].sort((a, b) =>
        treeSortDirection === "desc" ? b - a : a - b
      );

      if (showWeek) {
        sortedWeeks.forEach(week => {
          const weekEntries = weeks.get(week);

          const weekGroup = createGroup({
            key: `${year}-${month}-${week}`,
            title: `Week ${String(week).padStart(2, "0")}`,
            count: weekEntries.length,
            level: "week",
            children: renderTreeEntries(weekEntries)
          });

          monthContainer.appendChild(weekGroup);
        });
      } else {
        const monthEntries = [...weeks.values()].flat();

        monthContainer.appendChild(
          renderTreeEntries(monthEntries)
        );
      }

      if (showMonth) {
        const monthCount = [...weeks.values()]
          .reduce((sum, items) => sum + items.length, 0);

        const monthGroup = createGroup({
          key: `${year}-${month}`,
          title: monthNames[month],
          count: monthCount,
          level: "month",
          children: monthContainer
        });

        yearContainer.appendChild(monthGroup);
      } else {
        // Put weeks or entries directly under the year
        while (monthContainer.firstChild) {
          yearContainer.appendChild(monthContainer.firstChild);
        }
      }
    });

    // Only year grouping
    if (!showMonth && !showWeek) {
      const yearEntries = [...months.values()]
        .flatMap(weeks => [...weeks.values()].flat());

      yearContainer.appendChild(
        renderTreeEntries(yearEntries)
      );
    }

    // Calculate total entries for year
    const yearCount = [...months.values()]
      .reduce((sum, weeks) => {
        return sum + [...weeks.values()]
          .reduce((total, items) => total + items.length, 0);
      }, 0);

    const yearGroup = createGroup({
      key: String(year),
      title: String(year),
      count: yearCount,
      level: "year",
      children: yearContainer
    });

    treeView.appendChild(yearGroup);
  });

  updateCounts(filtered.length);
  updateEmptyState(filtered.length);
}


/* ========================================
   14. Expand / collapse all
======================================== */

function setAllGroups(collapsed) {
  treeView.querySelectorAll(".tree-group").forEach(group => {
    const key = group.dataset.groupKey;

    const heading = group.querySelector(
      ":scope > .tree-heading"
    );

    if (collapsed) {
      collapsedGroups.add(key);
      group.classList.add("collapsed");
    } else {
      collapsedGroups.delete(key);
      group.classList.remove("collapsed");
    }

    heading.setAttribute(
      "aria-expanded",
      String(!collapsed)
    );
  });
}

expandAllBtn.addEventListener("click", () => {
  setAllGroups(false);
});

collapseAllBtn.addEventListener("click", () => {
  setAllGroups(true);
});

// New 1

const treeSortBtn = document.getElementById("treeSortBtn");
const treeSortBtnLabel = document.getElementById("treeSortBtnLabel");
const treeSortBtnIcon = document.getElementById("treeSortBtnIcon");

treeSortBtn.addEventListener("click", () => {
  treeSortDirection =
    treeSortDirection === "desc" ? "asc" : "desc";

  treeSortBtnLabel.textContent =
    treeSortDirection === "desc"
      ? "Newest first"
      : "Oldest first";
  
  if (treeSortDirection === "desc") {
    treeSortBtnIcon.classList.replace("fa-long-arrow-alt-up", "fa-long-arrow-alt-down");
  } else {
    treeSortBtnIcon.classList.replace("fa-long-arrow-alt-down", "fa-long-arrow-alt-up");
  }

  renderTree();
});

// New 2

monthToggle.addEventListener("click", () => {
  showMonth = !showMonth;

  monthToggle.classList.toggle("active", showMonth);

  if (showMonth && showWeek) {
    document.documentElement.style.setProperty('--tree-indent', '78px');
  } else if (showMonth && !showWeek) {
    document.documentElement.style.setProperty('--tree-indent', '48px');
  } else if (!showMonth && showWeek) {
    document.documentElement.style.setProperty('--tree-indent', '48px');
  } else {
    document.documentElement.style.setProperty('--tree-indent', '18px');
  }
  renderTree();
});

weekToggle.addEventListener("click", () => {
  showWeek = !showWeek;

  weekToggle.classList.toggle("active", showWeek);

  if (showMonth && showWeek) {
    document.documentElement.style.setProperty('--tree-indent', '98px');
  } else if (showMonth && !showWeek) {
    document.documentElement.style.setProperty('--tree-indent', '68px');
  } else if (!showMonth && showWeek) {
    document.documentElement.style.setProperty('--tree-indent', '68px');
  } else {
    document.documentElement.style.setProperty('--tree-indent', '38px');
  }
  renderTree();
});

/* ========================================
   15. View switching
======================================== */

function setView(view) {
  currentView = view;

  const isTable = view === "table";

  tableView.hidden = !isTable;
  treeView.hidden = isTable;

  tableViewBtn.classList.toggle("active", isTable);
  treeViewBtn.classList.toggle("active", !isTable);

  expandAllBtn.hidden = isTable;
  collapseAllBtn.hidden = isTable;

  treeLevelControls.hidden = isTable;
  treeSortBtn.hidden = isTable;

  columnsDropdown.hidden = !isTable;

  paginationControls.hidden = !isTable;

  if (isTable) {
    renderTable();
  } else {
    renderTree();
  }
}

tableViewBtn.addEventListener("click", () => {
  setView("table");
});

treeViewBtn.addEventListener("click", () => {
  setView("tree");
});


/* ========================================
   16. Search
======================================== */

searchInput.addEventListener("input", event => {
  searchTerm = event.target.value.trim().toLowerCase();

  currentPage = 1;

  renderCurrentView();
});

clearSearchBtn.addEventListener("click", () => {
  searchInput.value = "";
  searchTerm = "";
  currentPage = 1;

  renderCurrentView();

  searchInput.focus();
});

/* ========================================
   17. Sorting
======================================== */

document.querySelectorAll(".data-table th").forEach((header, index) => {
  const columns = [
    "name",
    "date",
    "category",
    "amount",
    "status",
    "reference"
  ];

  const column = columns[index];

  header.style.cursor = "pointer";

  header.addEventListener("click", () => {
    if (sortColumn === column) {
      sortDirection =
        sortDirection === "asc" ? "desc" : "asc";
    } else {
      sortColumn = column;
      sortDirection = "asc";
    }

    currentPage = 1;

    renderCurrentView();
  });
});


/* ========================================
   18. Pagination
======================================== */

function renderPagination(totalEntries, totalPages) {

  pagination.innerHTML = "";

  // Calculate visible record range
  const start = totalEntries === 0
    ? 0
    : (currentPage - 1) * pageSize + 1;

  const end = Math.min(
    currentPage * pageSize,
    totalEntries
  );

  recordCount.textContent =
    `Showing ${start}-${end} of ${totalEntries} sorties`;

  // Helper for creating navigation buttons
  function addNavButton(label, targetPage, disabled = false, active = false) {
    const button = document.createElement("button");

    button.type = "button";
    button.disabled = disabled;

    const icon = document.createElement("i");
    icon.classList.add("fas", label);
    button.appendChild(icon);

    if (active) {
      button.classList.add("active");
      button.setAttribute("aria-current", "page");
    }

    button.addEventListener("click", () => {
      currentPage = targetPage;
      renderTable();
    });

    pagination.appendChild(button);
  }
  
  // Helper for creating page buttons
  function addPageButton(label, targetPage, disabled = false, active = false) {
    const button = document.createElement("button");

    button.type = "button";
    button.textContent = label;
    button.disabled = disabled;

    if (active) {
      button.classList.add("active");
      button.setAttribute("aria-current", "page");
    }

    button.addEventListener("click", () => {
      currentPage = targetPage;
      renderTable();
    });

    pagination.appendChild(button);
  }

  // First page
  addNavButton("fa-angle-double-left", 1, currentPage === 1);

  // Previous page
  addNavButton("fa-angle-left", currentPage - 1, currentPage === 1);

  // Calculate visible page numbers
  const maxVisiblePages = 5;

  let startPage = Math.max(1, currentPage - 2);

  let endPage = Math.min(
    totalPages,
    startPage + maxVisiblePages - 1
  );

  startPage = Math.max(
    1,
    endPage - maxVisiblePages + 1
  );

  // Page numbers
  for (let page = startPage; page <= endPage; page++) {
    addPageButton(
      page,
      page,
      false,
      page === currentPage
    );
  }

  // Next page
  addNavButton(
    "fa-angle-right",
    currentPage + 1,
    currentPage === totalPages
  );

  // Last page
  addNavButton(
    "fa-angle-double-right",
    totalPages,
    currentPage === totalPages
  );
}


/* ========================================
   PAGE SIZE SELECTOR
======================================== */

pageSizeSelect.addEventListener("change", event => {

  pageSize = Number(event.target.value);

  // Return to first page when changing page size
  currentPage = 1;

  renderTable();

});

/* ========================================
   19. Counts and empty state
======================================== */

function updateCounts(count) {
  headerCount.textContent = `${count} sorties`;

  if (currentView === "tree") {
    recordCount.textContent =
      `Showing ${count} of ${entries.length} sorties`;
  }
}

function updateEmptyState(count) {
  const isEmpty = count === 0;

  emptyState.hidden = !isEmpty;

  tableView.hidden = isEmpty || currentView !== "table";

  treeView.hidden = isEmpty || currentView !== "tree";
}


/* ========================================
   20. Render current view
======================================== */

function renderCurrentView() {
  if (currentView === "table") {
    renderTable();
  } else {
    renderTree();
  }
}

/* ========================================
   21. HTML escaping
======================================== */

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}


/* ========================================
   22. Initialization
======================================== */

function init() {
  // Generate entries
  entries = generateEntries(200);

  // Populate advanced filter dropdowns
  populateFilterOptions();

  // Initialize filter indicator
  updateFilterBadge();

  // Default sorting
  sortColumn = "date";
  sortDirection = "desc";

  // Initialize column visibility
  applyColumnVisibility();

  // Start in table view
  setView("table");
}

init();