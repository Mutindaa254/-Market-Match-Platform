// Theme toggle logic
document.addEventListener("DOMContentLoaded", function () {
  const themeBtn = document.getElementById("themeToggleBtn");
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const savedTheme = localStorage.getItem("theme");
  let darkMode = savedTheme === "dark" || (!savedTheme && prefersDark);

  function setTheme(dark) {
    document.body.classList.toggle("dark-theme", dark);
    themeBtn.innerHTML = dark
      ? '<i class="fas fa-sun"></i>'
      : '<i class="fas fa-moon"></i>';
    localStorage.setItem("theme", dark ? "dark" : "light");
  }

  setTheme(darkMode);

  themeBtn.addEventListener("click", function () {
    darkMode = !darkMode;
    setTheme(darkMode);
  });
});
document.addEventListener("DOMContentLoaded", function () {

  // Initialize variables
  let priceData = JSON.parse(localStorage.getItem("priceData")) || [];
  let priceChart = null;
  let currentEditId = null;
  let confirmAction = null;

  // DOM elements
  const priceForm = document.getElementById("priceForm");
  const priceTableBody = document.getElementById("priceTableBody");
  const noDataMessage = document.getElementById("noDataMessage");
  const filterProduct = document.getElementById("filterProduct");
  const filterSupplier = document.getElementById("filterSupplier");
  const filterDate = document.getElementById("filterDate");
  const customDateRange = document.getElementById("customDateRange");
  const startDate = document.getElementById("startDate");
  const endDate = document.getElementById("endDate");
  const applyFilter = document.getElementById("applyFilter");
  const resetFilter = document.getElementById("resetFilter");
  const exportBtn = document.getElementById("exportBtn");
  const deleteAllBtn = document.getElementById("deleteAllBtn");
  const editModal = new bootstrap.Modal(document.getElementById("editModal"));
  const helpModal = new bootstrap.Modal(document.getElementById("helpModal"));
  const confirmModal = new bootstrap.Modal(
    document.getElementById("confirmModal")
  );
  const confirmMessage = document.getElementById("confirmMessage");
  const confirmActionBtn = document.getElementById("confirmActionBtn");

  // Set today's date as default
  document.getElementById("date").valueAsDate = new Date();
  document.getElementById("editDate").valueAsDate = new Date();

  // Initialize the app
  renderPriceTable();
  renderPriceChart();
  updateNoDataMessage();

  // Event listeners
  priceForm.addEventListener("submit", handleFormSubmit);
  applyFilter.addEventListener("click", applyFilters);
  resetFilter.addEventListener("click", resetFilters);
  exportBtn.addEventListener("click", exportData);
  deleteAllBtn.addEventListener("click", confirmDeleteAll);
  confirmActionBtn.addEventListener("click", executeConfirmedAction);
  filterDate.addEventListener("change", toggleCustomDateRange);

  // Toggle custom date range visibility
  function toggleCustomDateRange() {
    if (filterDate.value === "custom") {
      customDateRange.classList.remove("d-none");
    } else {
      customDateRange.classList.add("d-none");
    }
  }

  // Handle form submission
  function handleFormSubmit(e) {
    e.preventDefault();

    const newEntry = {
      id: Date.now(),
      productName: document.getElementById("productName").value.trim(),
      supplierName: document.getElementById("supplierName").value.trim(),
      price: parseFloat(document.getElementById("price").value),
      date: document.getElementById("date").value,
      quantity: document.getElementById("quantity").value.trim(),
    };

    priceData.push(newEntry);
    saveData();
    renderPriceTable();
    renderPriceChart();
    updateNoDataMessage();

    // Reset form
    priceForm.reset();
    document.getElementById("date").valueAsDate = new Date();

    // Show success message
    showAlert("Price entry added successfully!", "success");
  }

  // Render price table
  function renderPriceTable(filteredData = null) {
    const dataToRender = filteredData || priceData;

    if (dataToRender.length === 0) {
      priceTableBody.innerHTML = "";
      return;
    }

    // Sort by date (newest first)
    const sortedData = [...dataToRender].sort(
      (a, b) => new Date(b.date) - new Date(a.date)
    );

    priceTableBody.innerHTML = sortedData
      .map((entry) => {
        // Find previous price for this product from the same supplier
        const previousEntry = findPreviousPrice(
          entry.productName,
          entry.supplierName,
          entry.date
        );

        let priceChangeIndicator = "";
        if (previousEntry) {
          if (entry.price > previousEntry.price) {
            priceChangeIndicator = `<span class="price-up"><i class="fas fa-arrow-up"></i> ₹${(
              entry.price - previousEntry.price
            ).toFixed(2)}</span>`;
          } else if (entry.price < previousEntry.price) {
            priceChangeIndicator = `<span class="price-down"><i class="fas fa-arrow-down"></i> ₹${(
              previousEntry.price - entry.price
            ).toFixed(2)}</span>`;
          } else {
            priceChangeIndicator = '<span class="price-same">No change</span>';
          }
        }

        return `
                <tr class="new-entry" >
                    <td>${entry.productName}</td>
                    <td>${entry.supplierName}</td>
                    <td>
                        ₹${entry.price.toFixed(2)}
                        ${priceChangeIndicator
            ? `<br><small>${priceChangeIndicator}</small>`
            : ""
          }
                    </td>
                    <td>${entry.quantity}</td>
                    <td>${formatDate(entry.date)}</td>
                    <td>
                        <button class="btn btn-sm btn-primary action-btn edit-btn" data-id="${entry.id
          }">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-danger action-btn delete-btn" data-id="${entry.id
          }">
                            <i class="fas fa-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
      })
      .join("");

    // Add event listeners to action buttons
    document.querySelectorAll(".edit-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        openEditModal(parseInt(btn.dataset.id))
      );
    });

    document.querySelectorAll(".delete-btn").forEach((btn) => {
      btn.addEventListener("click", () =>
        confirmDelete(parseInt(btn.dataset.id))
      );
    });
  }

  // Find previous price for a product from the same supplier
  function findPreviousPrice(productName, supplierName, currentDate) {
    const previousEntries = priceData.filter(
      (entry) =>
        entry.productName === productName &&
        entry.supplierName === supplierName &&
        entry.date < currentDate
    );

    if (previousEntries.length === 0) return null;

    // Sort by date (newest first) and return the most recent one
    previousEntries.sort((a, b) => new Date(b.date) - new Date(a.date));
    return previousEntries[0];
  }

  // Render price chart
  function renderPriceChart(filteredData = null) {
    const dataToRender = filteredData || priceData;

    if (dataToRender.length === 0) {
      if (priceChart) {
        priceChart.destroy();
      }
      return;
    }

    // Group by product and supplier
    const productMap = {};

    dataToRender.forEach((entry) => {
      const key = `${entry.productName} - ${entry.supplierName}`;
      if (!productMap[key]) {
        productMap[key] = [];
      }
      productMap[key].push({
        x: entry.date,
        y: entry.price,
      });
    });

    // Prepare datasets for Chart.js
    const datasets = Object.keys(productMap).map((key, index) => {
      const color = getColor(index);
      return {
        label: key,
        data: productMap[key],
        borderColor: color,
        backgroundColor: color,
        tension: 0.1,
        fill: false,
      };
    });

    // Sort datasets by date
    datasets.forEach((dataset) => {
      dataset.data.sort((a, b) => new Date(a.x) - new Date(b.x));
    });

    const ctx = document.getElementById("priceChart").getContext("2d");

    if (priceChart) {
      priceChart.destroy();
    }

    priceChart = new Chart(ctx, {
      type: "line",
      data: {
        datasets: datasets,
      },
      options: {
        responsive: true,
        scales: {
          x: {
            type: "time",
            time: {
              unit: "day",
              tooltipFormat: "MMM d, yyyy",
            },
            title: {
              display: true,
              text: "Date",
            },
          },
          y: {
            title: {
              display: true,
              text: "Price ($)",
            },
            beginAtZero: false,
          },
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: function (context) {
                return `${context.dataset.label}: $ ${context.parsed.y.toFixed(
                  2
                )}`;
              },
            },
          },
          legend: {
            position: "bottom",
            labels: {
              boxWidth: 12,
            },
          },
        },
      },
    });
  }

  // Get a color for the chart based on index
  function getColor(index) {
    const colors = [
      "#4e73df",
      "#1cc88a",
      "#36b9cc",
      "#f6c23e",
      "#e74a3b",
      "#5a5c69",
      "#858796",
      "#3a3b45",
      "#2e59d9",
      "#17a673",
      "#2c9faf",
      "#dda20a",
      "#be2617",
      "#e83e8c",
      "#6f42c1",
    ];
    return colors[index % colors.length];
  }

  // Apply filters
  function applyFilters() {
    let filteredData = [...priceData];

    // Filter by product name
    const productFilter = filterProduct.value.trim().toLowerCase();
    if (productFilter) {
      filteredData = filteredData.filter((entry) =>
        entry.productName.toLowerCase().includes(productFilter)
      );
    }

    // Filter by supplier name
    const supplierFilter = filterSupplier.value.trim().toLowerCase();
    if (supplierFilter) {
      filteredData = filteredData.filter((entry) =>
        entry.supplierName.toLowerCase().includes(supplierFilter)
      );
    }

    // Filter by date range
    const dateFilter = filterDate.value;
    if (dateFilter !== "all") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (dateFilter === "today") {
        filteredData = filteredData.filter((entry) => {
          const entryDate = new Date(entry.date);
          return entryDate >= today;
        });
      } else if (dateFilter === "week") {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);

        filteredData = filteredData.filter((entry) => {
          const entryDate = new Date(entry.date);
          return entryDate >= weekAgo;
        });
      } else if (dateFilter === "month") {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);

        filteredData = filteredData.filter((entry) => {
          const entryDate = new Date(entry.date);
          return entryDate >= monthAgo;
        });
      } else if (dateFilter === "custom") {
        const start = startDate.value;
        const end = endDate.value;

        if (start && end) {
          filteredData = filteredData.filter((entry) => {
            const entryDate = entry.date;
            return entryDate >= start && entryDate <= end;
          });
        }
      }
    }

    renderPriceTable(filteredData);
    renderPriceChart(filteredData);
  }

  // Reset filters
  function resetFilters() {
    filterProduct.value = "";
    filterSupplier.value = "";
    filterDate.value = "all";
    startDate.value = "";
    endDate.value = "";
    customDateRange.classList.add("d-none");

    renderPriceTable();
    renderPriceChart();
  }

  // Open edit modal
  function openEditModal(id) {
    const entry = priceData.find((item) => item.id === id);
    if (!entry) return;

    currentEditId = id;
    document.getElementById("editId").value = id;
    document.getElementById("editProductName").value = entry.productName;
    document.getElementById("editSupplierName").value = entry.supplierName;
    document.getElementById("editPrice").value = entry.price;
    document.getElementById("editDate").value = entry.date;
    document.getElementById("editQuantity").value = entry.quantity;

    editModal.show();

    // Set up save button
    document.getElementById("saveEditBtn").onclick = saveEditedEntry;
  }

  // Save edited entry
  function saveEditedEntry() {
    const index = priceData.findIndex((item) => item.id === currentEditId);
    if (index === -1) return;

    priceData[index] = {
      id: currentEditId,
      productName: document.getElementById("editProductName").value.trim(),
      supplierName: document.getElementById("editSupplierName").value.trim(),
      price: parseFloat(document.getElementById("editPrice").value),
      date: document.getElementById("editDate").value,
      quantity: document.getElementById("editQuantity").value.trim(),
    };

    saveData();
    renderPriceTable();
    renderPriceChart();
    editModal.hide();

    showAlert("Price entry updated successfully!", "success");
  }

  // Confirm delete
  function confirmDelete(id) {
    currentEditId = id;
    confirmAction = "delete";

    const entry = priceData.find((item) => item.id === id);
    if (entry) {
      confirmMessage.innerHTML = `
                Are you sure you want to delete this entry?<br><br>
                <strong>${entry.productName}</strong> from <strong>${entry.supplierName
        }</strong><br>
                Price: <strong>₹${entry.price.toFixed(2)}</strong> (${entry.quantity
        })<br>
                Date: <strong>${formatDate(entry.date)}</strong>
            `;
    }

    confirmModal.show();
  }

  // Confirm delete all
  function confirmDeleteAll() {
    if (priceData.length === 0) return;

    currentEditId = null;
    confirmAction = "deleteAll";
    confirmMessage.innerHTML = `
            Are you sure you want to delete ALL ${priceData.length} price entries?<br><br>
            <strong>This action cannot be undone!</strong>
        `;

    confirmModal.show();
  }

  // Execute confirmed action
  function executeConfirmedAction() {
    if (confirmAction === "delete") {
      priceData = priceData.filter((item) => item.id !== currentEditId);
      saveData();
      renderPriceTable();
      renderPriceChart();
      updateNoDataMessage();
      showAlert("Price entry deleted successfully!", "success");
    } else if (confirmAction === "deleteAll") {
      priceData = [];
      saveData();
      renderPriceTable();
      renderPriceChart();
      updateNoDataMessage();
      showAlert("All price entries have been deleted!", "success");
    }

    confirmModal.hide();
  }

  // Export data as PDF
  function exportData() {
    if (priceData.length === 0) {
      showAlert("No data to export!", "warning");
      return;
    }

    // Check if jsPDF is loaded
    if (
      typeof window.jspdf === "undefined" &&
      typeof window.jsPDF === "undefined"
    ) {
      showAlert("jsPDF library is required to export PDF!", "danger");
      return;
    }

    // Use jsPDF (v2+)
    const doc = new (window.jsPDF || window.jspdf.jsPDF)({
      orientation: "landscape",
      unit: "pt",
      format: "A4",
    });

    // Table headers and rows
    const headers = [
      ["Product Name", "Supplier Name", "Price ($)", "Quantity/Unit", "Date"],
    ];
    const rows = priceData.map((entry) => [
      entry.productName,
      entry.supplierName,
      entry.price.toFixed(2),
      entry.quantity,
      entry.date,
    ]);

    // Add title
    doc.setFontSize(16);
    doc.text("Price Tracker Data Export", 40, 40);

    // Add table (using autoTable if available)
    if (doc.autoTable) {
      doc.autoTable({
        head: headers,
        body: rows,
        startY: 60,
        styles: { fontSize: 10 },
        headStyles: { fillColor: [78, 115, 223] },
      });
    } else {
      // Fallback: simple text rows
      let y = 70;
      doc.setFontSize(12);
      doc.text(headers[0].join(" | "), 40, y);
      y += 20;
      rows.forEach((row) => {
        doc.text(row.join(" | "), 40, y);
        y += 16;
      });
    }

    // Save PDF
   const fileName = `Code Crafters G9 - Price Tracker (${new Date().toISOString().slice(0, 10).replace(/-/g, "_")}).pdf`;
doc.save(fileName);

  }

  // Save data to localStorage
  function saveData() {
    localStorage.setItem("priceData", JSON.stringify(priceData));
  }

  // Update no data message visibility
  function updateNoDataMessage() {
    if (priceData.length === 0) {
      noDataMessage.style.display = "block";
    } else {
      noDataMessage.style.display = "none";
    }
  }

  // Format date for display
  function formatDate(dateString) {
    const options = { year: "numeric", month: "short", day: "numeric" };
    return new Date(dateString).toLocaleDateString(undefined, options);
  }

  // Show alert message
  function showAlert(message, type) {
    const alertDiv = document.createElement("div");
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = "alert";
    alertDiv.innerHTML = `
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
        `;

    const container = document.querySelector(".container-fluid");
    container.insertBefore(alertDiv, container.firstChild);

    // Auto dismiss after 3 seconds
    setTimeout(() => {
      const bsAlert = new bootstrap.Alert(alertDiv);
      bsAlert.close();
    }, 3000);
  }

  // Initialize with sample data if empty (for demo purposes)
  if (priceData.length === 0 && window.location.href.includes("localhost")) {
    const sampleData = [
      {
        id: 1,
        productName: "Rice",
        supplierName: "Grocery Wholesale",
        price: 45.5,
        date: "2023-06-01",
        quantity: "1 kg",
      },
      {
        id: 2,
        productName: "Rice",
        supplierName: "Local Market",
        price: 47.0,
        date: "2023-06-02",
        quantity: "1 kg",
      },
      {
        id: 3,
        productName: "Sugar",
        supplierName: "Sweet Distributors",
        price: 42.75,
        date: "2023-06-03",
        quantity: "1 kg",
      },
      {
        id: 4,
        productName: "Rice",
        supplierName: "Grocery Wholesale",
        price: 46.25,
        date: "2023-06-10",
        quantity: "1 kg",
      },
      {
        id: 5,
        productName: "Sugar",
        supplierName: "Sweet Distributors",
        price: 43.5,
        date: "2023-06-15",
        quantity: "1 kg",
      },
    ];

    priceData = sampleData;
    saveData();
    renderPriceTable();
    renderPriceChart();
    updateNoDataMessage();
  }
});
