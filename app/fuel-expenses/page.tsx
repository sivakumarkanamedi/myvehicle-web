"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  Car,
  CheckCircle2,
  ChevronDown,
  Fuel,
  IndianRupee,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { supabase } from "../../supabase";

type Vehicle = {
  id: number;
  vehicle_name: string | null;
  vehicle_number: string | null;
  brand: string | null;
  model: string | null;
};

type FuelLog = {
  id: number;
  user_id: string;
  vehicle_id: number;
  fuel_date: string;
  fuel_type: string;
  litres: number;
  total_amount: number;
  fuel_station: string | null;
  full_tank: boolean;
  notes: string | null;
  created_at: string;
};

type ExpenseCategory =
  | "service"
  | "insurance"
  | "other";

type ExpenseRow = {
  id: number;
  user_id: string;
  vehicle_id: number;
  expense_date: string;
  category: ExpenseCategory;
  title: string;
  amount: number;
  notes: string | null;
  created_at: string;
};

type TabValue = "fuel" | "expenses";

const EXPENSE_CATEGORIES: Array<{
  value: ExpenseCategory;
  label: string;
}> = [
  {
    value: "service",
    label: "Service",
  },
  {
    value: "insurance",
    label: "Insurance",
  },
  {
    value: "other",
    label: "Other",
  },
];

function currency(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function dateLabel(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function categoryLabel(value: ExpenseCategory) {
  return (
    EXPENSE_CATEGORIES.find(
      (category) =>
        category.value === value
    )?.label || "Other"
  );
}

export default function FuelExpensePage() {
  const router = useRouter();

  const [vehicles, setVehicles] =
    useState<Vehicle[]>([]);

  const [
    selectedVehicleId,
    setSelectedVehicleId,
  ] = useState<number | null>(
    null
  );

  const [fuelLogs, setFuelLogs] =
    useState<FuelLog[]>([]);

  const [expenses, setExpenses] =
    useState<ExpenseRow[]>([]);

  const [tab, setTab] =
    useState<TabValue>("fuel");

  const [search, setSearch] =
    useState("");

  const [
    categoryFilter,
    setCategoryFilter,
  ] = useState<
    "all" | ExpenseCategory
  >("all");

  const [loading, setLoading] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [saving, setSaving] =
    useState(false);

  const [
    workingId,
    setWorkingId,
  ] = useState<number | null>(
    null
  );

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [
    showFuelModal,
    setShowFuelModal,
  ] = useState(false);

  const [
    showExpenseModal,
    setShowExpenseModal,
  ] = useState(false);

  const [
    editingFuel,
    setEditingFuel,
  ] = useState<FuelLog | null>(
    null
  );

  const [
    editingExpense,
    setEditingExpense,
  ] = useState<ExpenseRow | null>(
    null
  );

  const [
    miraQuestion,
    setMiraQuestion,
  ] = useState("");

  const [miraReply, setMiraReply] =
    useState(
      "I can explain fuel, service, insurance and other vehicle expenses."
    );

  const [fuelForm, setFuelForm] =
    useState({
      fuelDate: new Date()
        .toISOString()
        .slice(0, 10),
      fuelType: "petrol",
      litres: "",
      totalAmount: "",
      fuelStation: "",
      fullTank: false,
      notes: "",
    });

  const [
    expenseForm,
    setExpenseForm,
  ] = useState({
    expenseDate: new Date()
      .toISOString()
      .slice(0, 10),
    category:
      "service" as ExpenseCategory,
    title: "",
    amount: "",
    notes: "",
  });

  const loadData =
    useCallback(
      async (
        showRefresh = false
      ) => {
        if (showRefresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setError("");
        setMessage("");

        try {
          const {
            data: { user },
            error:
              userError,
          } =
            await supabase.auth.getUser();

          if (
            userError ||
            !user
          ) {
            router.replace(
              "/login"
            );
            return;
          }

          const {
            data:
              vehicleData,
            error:
              vehicleError,
          } = await supabase
            .from("vehicles")
            .select(
              "id, vehicle_name, vehicle_number, brand, model"
            )
            .eq(
              "user_id",
              user.id
            )
            .order("id", {
              ascending:
                false,
            });

          if (vehicleError) {
            throw vehicleError;
          }

          const availableVehicles =
            (vehicleData ||
              []) as Vehicle[];

          setVehicles(
            availableVehicles
          );

          const activeVehicleId =
            selectedVehicleId &&
            availableVehicles.some(
              (vehicle) =>
                vehicle.id ===
                selectedVehicleId
            )
              ? selectedVehicleId
              : availableVehicles[0]
                  ?.id || null;

          setSelectedVehicleId(
            activeVehicleId
          );

          if (!activeVehicleId) {
            setFuelLogs([]);
            setExpenses([]);
            return;
          }

          const [
            fuelResult,
            expenseResult,
          ] =
            await Promise.all([
              supabase
                .from(
                  "fuel_logs"
                )
                .select(
                  "id, user_id, vehicle_id, fuel_date, fuel_type, litres, total_amount, fuel_station, full_tank, notes, created_at"
                )
                .eq(
                  "user_id",
                  user.id
                )
                .eq(
                  "vehicle_id",
                  activeVehicleId
                )
                .order(
                  "fuel_date",
                  {
                    ascending:
                      false,
                  }
                ),

              supabase
                .from(
                  "vehicle_expenses"
                )
                .select(
                  "id, user_id, vehicle_id, expense_date, category, title, amount, notes, created_at"
                )
                .eq(
                  "user_id",
                  user.id
                )
                .eq(
                  "vehicle_id",
                  activeVehicleId
                )
                .in(
                  "category",
                  [
                    "service",
                    "insurance",
                    "other",
                  ]
                )
                .order(
                  "expense_date",
                  {
                    ascending:
                      false,
                  }
                ),
            ]);

          if (
            fuelResult.error
          ) {
            throw fuelResult.error;
          }

          if (
            expenseResult.error
          ) {
            throw expenseResult.error;
          }

          setFuelLogs(
            (fuelResult.data ||
              []) as FuelLog[]
          );

          setExpenses(
            (expenseResult.data ||
              []) as ExpenseRow[]
          );
        } catch (
          caughtError
        ) {
          setError(
            caughtError instanceof
              Error
              ? caughtError.message
              : "Unable to load expenses."
          );
        } finally {
          setLoading(false);
          setRefreshing(false);
        }
      },
      [
        router,
        selectedVehicleId,
      ]
    );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const selectedVehicle =
    useMemo(
      () =>
        vehicles.find(
          (vehicle) =>
            vehicle.id ===
            selectedVehicleId
        ) || null,
      [
        selectedVehicleId,
        vehicles,
      ]
    );

  const visibleFuelLogs =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return fuelLogs.filter(
        (item) =>
          !query ||
          `${item.fuel_type} ${
            item.fuel_station ||
            ""
          } ${item.notes || ""}`
            .toLowerCase()
            .includes(query)
      );
    }, [fuelLogs, search]);

  const visibleExpenses =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return expenses.filter(
        (item) => {
          const matchesSearch =
            !query ||
            `${item.title} ${
              item.notes || ""
            } ${categoryLabel(
              item.category
            )}`
              .toLowerCase()
              .includes(query);

          const matchesCategory =
            categoryFilter ===
              "all" ||
            item.category ===
              categoryFilter;

          return (
            matchesSearch &&
            matchesCategory
          );
        }
      );
    }, [
      categoryFilter,
      expenses,
      search,
    ]);

  const analytics = useMemo(() => {
    const now = new Date();

    const fuelCost =
      fuelLogs.reduce(
        (sum, item) =>
          sum +
          Number(
            item.total_amount ||
              0
          ),
        0
      );

    const serviceCost =
      expenses
        .filter(
          (item) =>
            item.category ===
            "service"
        )
        .reduce(
          (sum, item) =>
            sum +
            Number(
              item.amount ||
                0
            ),
          0
        );

    const insuranceCost =
      expenses
        .filter(
          (item) =>
            item.category ===
            "insurance"
        )
        .reduce(
          (sum, item) =>
            sum +
            Number(
              item.amount ||
                0
            ),
          0
        );

    const otherCost =
      expenses
        .filter(
          (item) =>
            item.category ===
            "other"
        )
        .reduce(
          (sum, item) =>
            sum +
            Number(
              item.amount ||
                0
            ),
          0
        );

    const currentMonth =
      now
        .toISOString()
        .slice(0, 7);

    const currentYear =
      now.getFullYear();

    const thisMonth =
      fuelLogs
        .filter(
          (item) =>
            item.fuel_date.slice(
              0,
              7
            ) ===
            currentMonth
        )
        .reduce(
          (sum, item) =>
            sum +
            Number(
              item.total_amount ||
                0
            ),
          0
        ) +
      expenses
        .filter(
          (item) =>
            item.expense_date.slice(
              0,
              7
            ) ===
            currentMonth
        )
        .reduce(
          (sum, item) =>
            sum +
            Number(
              item.amount ||
                0
            ),
          0
        );

    const thisYear =
      fuelLogs
        .filter(
          (item) =>
            new Date(
              item.fuel_date
            ).getFullYear() ===
            currentYear
        )
        .reduce(
          (sum, item) =>
            sum +
            Number(
              item.total_amount ||
                0
            ),
          0
        ) +
      expenses
        .filter(
          (item) =>
            new Date(
              item.expense_date
            ).getFullYear() ===
            currentYear
        )
        .reduce(
          (sum, item) =>
            sum +
            Number(
              item.amount ||
                0
            ),
          0
        );

    const lifetime =
      fuelCost +
      serviceCost +
      insuranceCost +
      otherCost;

    return {
      fuelCost,
      serviceCost,
      insuranceCost,
      otherCost,
      thisMonth,
      thisYear,
      lifetime,
    };
  }, [expenses, fuelLogs]);

  function openFuelCreate() {
    setEditingFuel(null);

    setFuelForm({
      fuelDate: new Date()
        .toISOString()
        .slice(0, 10),
      fuelType: "petrol",
      litres: "",
      totalAmount: "",
      fuelStation: "",
      fullTank: false,
      notes: "",
    });

    setShowFuelModal(true);
  }

  function openFuelEdit(
    item: FuelLog
  ) {
    setEditingFuel(item);

    setFuelForm({
      fuelDate:
        item.fuel_date,
      fuelType:
        item.fuel_type,
      litres:
        item.litres?.toString() ||
        "",
      totalAmount:
        item.total_amount?.toString() ||
        "",
      fuelStation:
        item.fuel_station ||
        "",
      fullTank:
        item.full_tank,
      notes:
        item.notes || "",
    });

    setShowFuelModal(true);
  }

  function openExpenseCreate() {
    setEditingExpense(null);

    setExpenseForm({
      expenseDate: new Date()
        .toISOString()
        .slice(0, 10),
      category: "service",
      title: "",
      amount: "",
      notes: "",
    });

    setShowExpenseModal(true);
  }

  function openExpenseEdit(
    item: ExpenseRow
  ) {
    setEditingExpense(item);

    setExpenseForm({
      expenseDate:
        item.expense_date,
      category:
        item.category,
      title: item.title,
      amount:
        item.amount?.toString() ||
        "",
      notes:
        item.notes || "",
    });

    setShowExpenseModal(true);
  }

  async function saveFuel() {
    if (
      !selectedVehicleId ||
      saving
    ) {
      return;
    }

    const litres =
      Number(
        fuelForm.litres
      );

    const totalAmount =
      Number(
        fuelForm.totalAmount
      );

    if (
      !fuelForm.fuelDate ||
      !Number.isFinite(
        litres
      ) ||
      litres <= 0 ||
      !Number.isFinite(
        totalAmount
      ) ||
      totalAmount <= 0
    ) {
      setError(
        "Date, litres or units, and amount are required."
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Your session has expired."
        );
      }

      const payload = {
        user_id: user.id,
        vehicle_id:
          selectedVehicleId,
        fuel_date:
          fuelForm.fuelDate,
        fuel_type:
          fuelForm.fuelType,
        litres,
        price_per_litre:
          litres > 0
            ? totalAmount /
              litres
            : 0,
        total_amount:
          totalAmount,
        fuel_station:
          fuelForm.fuelStation.trim() ||
          null,
        full_tank:
          fuelForm.fullTank,
        notes:
          fuelForm.notes.trim() ||
          null,
        odometer_km: null,
        receipt_path: null,
      };

      const result =
        editingFuel
          ? await supabase
              .from(
                "fuel_logs"
              )
              .update(payload)
              .eq(
                "id",
                editingFuel.id
              )
          : await supabase
              .from(
                "fuel_logs"
              )
              .insert(payload);

      if (result.error) {
        throw result.error;
      }

      setShowFuelModal(
        false
      );

      setMessage(
        editingFuel
          ? "Fuel entry updated."
          : "Fuel entry added."
      );

      await loadData(true);
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to save fuel entry."
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveExpense() {
    if (
      !selectedVehicleId ||
      saving
    ) {
      return;
    }

    const amount =
      Number(
        expenseForm.amount
      );

    if (
      !expenseForm.expenseDate ||
      !expenseForm.title.trim() ||
      !Number.isFinite(
        amount
      ) ||
      amount <= 0
    ) {
      setError(
        "Date, title and amount are required."
      );
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        throw new Error(
          "Your session has expired."
        );
      }

      const payload = {
        user_id: user.id,
        vehicle_id:
          selectedVehicleId,
        expense_date:
          expenseForm.expenseDate,
        category:
          expenseForm.category,
        title:
          expenseForm.title.trim(),
        amount,
        vendor_name: null,
        receipt_path: null,
        notes:
          expenseForm.notes.trim() ||
          null,
      };

      const result =
        editingExpense
          ? await supabase
              .from(
                "vehicle_expenses"
              )
              .update(payload)
              .eq(
                "id",
                editingExpense.id
              )
          : await supabase
              .from(
                "vehicle_expenses"
              )
              .insert(payload);

      if (result.error) {
        throw result.error;
      }

      setShowExpenseModal(
        false
      );

      setMessage(
        editingExpense
          ? "Expense updated."
          : "Expense added."
      );

      await loadData(true);
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to save expense."
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteRecord(
    table:
      | "fuel_logs"
      | "vehicle_expenses",
    id: number
  ) {
    const confirmed =
      window.confirm(
        "Delete this record permanently?"
      );

    if (
      !confirmed ||
      workingId !== null
    ) {
      return;
    }

    setWorkingId(id);
    setError("");
    setMessage("");

    try {
      const {
        error:
          deleteError,
      } = await supabase
        .from(table)
        .delete()
        .eq("id", id);

      if (deleteError) {
        throw deleteError;
      }

      setMessage(
        "Record deleted."
      );

      await loadData(true);
    } catch (
      caughtError
    ) {
      setError(
        caughtError instanceof
          Error
          ? caughtError.message
          : "Unable to delete record."
      );
    } finally {
      setWorkingId(null);
    }
  }

  function askMira(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const question =
      miraQuestion
        .trim()
        .toLowerCase();

    if (!question) {
      return;
    }

    if (
      question.includes(
        "fuel"
      )
    ) {
      setMiraReply(
        `Recorded fuel expense is ${currency(
          analytics.fuelCost
        )}.`
      );
    } else if (
      question.includes(
        "service"
      )
    ) {
      setMiraReply(
        `Recorded service expense is ${currency(
          analytics.serviceCost
        )}.`
      );
    } else if (
      question.includes(
        "insurance"
      )
    ) {
      setMiraReply(
        `Recorded insurance expense is ${currency(
          analytics.insuranceCost
        )}.`
      );
    } else if (
      question.includes(
        "month"
      )
    ) {
      setMiraReply(
        `You spent ${currency(
          analytics.thisMonth
        )} this month.`
      );
    } else if (
      question.includes(
        "year"
      )
    ) {
      setMiraReply(
        `You spent ${currency(
          analytics.thisYear
        )} this year.`
      );
    } else {
      setMiraReply(
        `Total recorded expense is ${currency(
          analytics.lifetime
        )}.`
      );
    }

    setMiraQuestion("");
  }

  if (loading) {
    return (
      <main style={loadingPageStyle}>
        <div
          style={{
            textAlign:
              "center",
          }}
        >
          <Loader2
            size={38}
            style={{
              animation:
                "spin 1s linear infinite",
            }}
          />

          <p
            style={{
              color:
                "#94a3b8",
            }}
          >
            Loading expenses...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={pageStyle}>
      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        body {
          margin: 0;
        }

        button,
        input,
        select,
        textarea {
          font: inherit;
        }

        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }

        @media (max-width: 760px) {
          .expense-summary-grid {
            grid-template-columns: repeat(
              2,
              minmax(0, 1fr)
            ) !important;
          }

          .expense-toolbar {
            grid-template-columns: 1fr !important;
          }

          .form-two-column {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      <div
        style={{
          width:
            "min(1120px, 100%)",
          margin: "0 auto",
        }}
      >
        <div style={topBarStyle}>
          <button
            type="button"
            onClick={() =>
              router.push("/")
            }
            style={
              secondaryButtonStyle
            }
          >
            <ArrowLeft
              size={17}
            />
            Dashboard
          </button>

          <div
            style={{
              display:
                "flex",
              gap: "9px",
              flexWrap:
                "wrap",
            }}
          >
            <button
              type="button"
              onClick={() =>
                void loadData(
                  true
                )
              }
              disabled={
                refreshing
              }
              style={
                secondaryButtonStyle
              }
            >
              <RefreshCw
                size={16}
                style={
                  refreshing
                    ? {
                        animation:
                          "spin 1s linear infinite",
                      }
                    : undefined
                }
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={
                tab === "fuel"
                  ? openFuelCreate
                  : openExpenseCreate
              }
              style={
                primaryButtonStyle
              }
            >
              <Plus size={17} />
              {tab === "fuel"
                ? "Add Fuel"
                : "Add Expense"}
            </button>
          </div>
        </div>

        <header
          style={{
            marginTop:
              "24px",
          }}
        >
          <div style={eyebrowStyle}>
            My Vehicle
          </div>

          <h1 style={titleStyle}>
            Fuel & Expense Tracker
          </h1>

          <p
            style={
              descriptionStyle
            }
          >
            Track only fuel, service, insurance and other vehicle expenses.
          </p>
        </header>

        {error && (
          <div
            style={
              errorStyle
            }
          >
            <AlertTriangle
              size={18}
            />
            {error}
          </div>
        )}

        {message && (
          <div
            style={
              successStyle
            }
          >
            <CheckCircle2
              size={18}
            />
            {message}
          </div>
        )}

        {vehicles.length ===
        0 ? (
          <section
            style={
              emptyStyle
            }
          >
            <Car
              size={44}
              color="#64748b"
            />

            <h2>
              Add your first vehicle
            </h2>

            <button
              type="button"
              onClick={() =>
                router.push(
                  "/add-vehicle"
                )
              }
              style={
                primaryButtonStyle
              }
            >
              Add Vehicle
            </button>
          </section>
        ) : (
          <>
            <section
              style={
                vehicleSelectorStyle
              }
            >
              <div>
                <div
                  style={{
                    fontWeight:
                      950,
                  }}
                >
                  {selectedVehicle?.vehicle_name ||
                    [
                      selectedVehicle?.brand,
                      selectedVehicle?.model,
                    ]
                      .filter(
                        Boolean
                      )
                      .join(
                        " "
                      ) ||
                    "My Vehicle"}
                </div>

                <div
                  style={
                    mutedSmallStyle
                  }
                >
                  {selectedVehicle?.vehicle_number ||
                    "Number not added"}
                </div>
              </div>

              <div
                style={{
                  position:
                    "relative",
                }}
              >
                <select
                  value={
                    selectedVehicleId ||
                    ""
                  }
                  onChange={(
                    event
                  ) =>
                    setSelectedVehicleId(
                      Number(
                        event
                          .target
                          .value
                      )
                    )
                  }
                  style={
                    vehicleSelectStyle
                  }
                >
                  {vehicles.map(
                    (
                      vehicle
                    ) => (
                      <option
                        key={
                          vehicle.id
                        }
                        value={
                          vehicle.id
                        }
                      >
                        {vehicle.vehicle_number ||
                          vehicle.vehicle_name ||
                          `Vehicle ${vehicle.id}`}
                      </option>
                    )
                  )}
                </select>

                <ChevronDown
                  size={16}
                  style={
                    selectArrowStyle
                  }
                />
              </div>
            </section>

            <section
              className="expense-summary-grid"
              style={
                summaryGridStyle
              }
            >
              <SummaryCard
                icon={
                  IndianRupee
                }
                label="This Month"
                value={currency(
                  analytics.thisMonth
                )}
              />

              <SummaryCard
                icon={
                  WalletCards
                }
                label="This Year"
                value={currency(
                  analytics.thisYear
                )}
              />

              <SummaryCard
                icon={Fuel}
                label="Fuel"
                value={currency(
                  analytics.fuelCost
                )}
              />

              <SummaryCard
                icon={
                  IndianRupee
                }
                label="Lifetime"
                value={currency(
                  analytics.lifetime
                )}
              />
            </section>

            <section
              style={
                categoryGridStyle
              }
            >
              <CategoryCard
                label="Service"
                value={
                  analytics.serviceCost
                }
              />

              <CategoryCard
                label="Insurance"
                value={
                  analytics.insuranceCost
                }
              />

              <CategoryCard
                label="Other"
                value={
                  analytics.otherCost
                }
              />
            </section>

            <section
              style={
                tabBarStyle
              }
            >
              <button
                type="button"
                onClick={() =>
                  setTab("fuel")
                }
                style={
                  tab === "fuel"
                    ? activeTabStyle
                    : inactiveTabStyle
                }
              >
                <Fuel size={17} />
                Fuel
              </button>

              <button
                type="button"
                onClick={() =>
                  setTab(
                    "expenses"
                  )
                }
                style={
                  tab ===
                  "expenses"
                    ? activeTabStyle
                    : inactiveTabStyle
                }
              >
                <WalletCards
                  size={17}
                />
                Expenses
              </button>
            </section>

            <section
              className="expense-toolbar"
              style={{
                marginTop:
                  "14px",
                display:
                  "grid",
                gridTemplateColumns:
                  tab ===
                  "expenses"
                    ? "1fr 190px"
                    : "1fr",
                gap: "12px",
              }}
            >
              <label
                style={{
                  position:
                    "relative",
                }}
              >
                <Search
                  size={17}
                  style={
                    searchIconStyle
                  }
                />

                <input
                  value={
                    search
                  }
                  onChange={(
                    event
                  ) =>
                    setSearch(
                      event
                        .target
                        .value
                    )
                  }
                  placeholder={
                    tab ===
                    "fuel"
                      ? "Search fuel entries..."
                      : "Search expenses..."
                  }
                  style={
                    searchInputStyle
                  }
                />
              </label>

              {tab ===
                "expenses" && (
                <div
                  style={{
                    position:
                      "relative",
                  }}
                >
                  <select
                    value={
                      categoryFilter
                    }
                    onChange={(
                      event
                    ) =>
                      setCategoryFilter(
                        event
                          .target
                          .value as
                          | "all"
                          | ExpenseCategory
                      )
                    }
                    style={
                      filterSelectStyle
                    }
                  >
                    <option value="all">
                      All Categories
                    </option>

                    {EXPENSE_CATEGORIES.map(
                      (
                        category
                      ) => (
                        <option
                          key={
                            category.value
                          }
                          value={
                            category.value
                          }
                        >
                          {
                            category.label
                          }
                        </option>
                      )
                    )}
                  </select>

                  <ChevronDown
                    size={16}
                    style={
                      selectArrowStyle
                    }
                  />
                </div>
              )}
            </section>

            <section
              style={{
                marginTop:
                  "18px",
                display:
                  "grid",
                gap: "12px",
              }}
            >
              {tab === "fuel" ? (
                visibleFuelLogs.length ===
                0 ? (
                  <EmptyRecords
                    icon={Fuel}
                    title="No fuel entries found"
                    description="Add your first fuel entry."
                  />
                ) : (
                  visibleFuelLogs.map(
                    (item) => (
                      <article
                        key={
                          item.id
                        }
                        style={
                          recordCardStyle
                        }
                      >
                        <div
                          style={
                            recordLeftStyle
                          }
                        >
                          <div
                            style={
                              fuelIconStyle
                            }
                          >
                            <Fuel
                              size={
                                21
                              }
                            />
                          </div>

                          <div>
                            <h3
                              style={
                                recordTitleStyle
                              }
                            >
                              {item.fuel_type.toUpperCase()} ·{" "}
                              {Number(
                                item.litres
                              ).toFixed(
                                2
                              )}{" "}
                              L / Units
                            </h3>

                            <p
                              style={
                                recordDescriptionStyle
                              }
                            >
                              {item.fuel_station ||
                                "Fuel station not recorded"}{" "}
                              ·{" "}
                              {dateLabel(
                                item.fuel_date
                              )}
                            </p>

                            <div
                              style={
                                metaStyle
                              }
                            >
                              <span>
                                {currency(
                                  item.total_amount
                                )}
                              </span>

                              {item.full_tank && (
                                <span>
                                  Full Tank
                                </span>
                              )}
                            </div>

                            {item.notes && (
                              <p
                                style={
                                  notesStyle
                                }
                              >
                                {
                                  item.notes
                                }
                              </p>
                            )}
                          </div>
                        </div>

                        <RecordActions
                          onEdit={() =>
                            openFuelEdit(
                              item
                            )
                          }
                          onDelete={() =>
                            deleteRecord(
                              "fuel_logs",
                              item.id
                            )
                          }
                          loading={
                            workingId ===
                            item.id
                          }
                        />
                      </article>
                    )
                  )
                )
              ) : visibleExpenses.length ===
                0 ? (
                <EmptyRecords
                  icon={
                    WalletCards
                  }
                  title="No expenses found"
                  description="Add a service, insurance or other expense."
                />
              ) : (
                visibleExpenses.map(
                  (item) => (
                    <article
                      key={item.id}
                      style={
                        recordCardStyle
                      }
                    >
                      <div
                        style={
                          recordLeftStyle
                        }
                      >
                        <div
                          style={
                            expenseIconStyle
                          }
                        >
                          <WalletCards
                            size={21}
                          />
                        </div>

                        <div>
                          <div
                            style={
                              titleRowStyle
                            }
                          >
                            <h3
                              style={
                                recordTitleStyle
                              }
                            >
                              {
                                item.title
                              }
                            </h3>

                            <span
                              style={
                                categoryPillStyle
                              }
                            >
                              {categoryLabel(
                                item.category
                              )}
                            </span>
                          </div>

                          <p
                            style={
                              recordDescriptionStyle
                            }
                          >
                            {dateLabel(
                              item.expense_date
                            )}
                          </p>

                          <div
                            style={
                              metaStyle
                            }
                          >
                            <span>
                              {currency(
                                item.amount
                              )}
                            </span>
                          </div>

                          {item.notes && (
                            <p
                              style={
                                notesStyle
                              }
                            >
                              {
                                item.notes
                              }
                            </p>
                          )}
                        </div>
                      </div>

                      <RecordActions
                        onEdit={() =>
                          openExpenseEdit(
                            item
                          )
                        }
                        onDelete={() =>
                          deleteRecord(
                            "vehicle_expenses",
                            item.id
                          )
                        }
                        loading={
                          workingId ===
                          item.id
                        }
                      />
                    </article>
                  )
                )
              )}
            </section>

            <section
              style={
                miraStyle
              }
            >
              <Sparkles
                size={20}
                color="#c4b5fd"
              />

              <div
                style={{
                  flex: 1,
                }}
              >
                <div
                  style={{
                    fontWeight:
                      950,
                  }}
                >
                  Ask Mira Expenses
                </div>

                <div
                  style={
                    miraTextStyle
                  }
                >
                  {miraReply}
                </div>

                <form
                  onSubmit={
                    askMira
                  }
                  style={
                    miraFormStyle
                  }
                >
                  <input
                    value={
                      miraQuestion
                    }
                    onChange={(
                      event
                    ) =>
                      setMiraQuestion(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="Ask about fuel, service, insurance, month or year..."
                    style={
                      miraInputStyle
                    }
                  />

                  <button
                    type="submit"
                    disabled={
                      !miraQuestion.trim()
                    }
                    style={{
                      ...primaryButtonStyle,
                      opacity:
                        miraQuestion.trim()
                          ? 1
                          : 0.5,
                    }}
                  >
                    Ask Mira
                  </button>
                </form>
              </div>
            </section>
          </>
        )}
      </div>

      {showFuelModal && (
        <Modal
          title={
            editingFuel
              ? "Edit Fuel Entry"
              : "Add Fuel Entry"
          }
          onClose={() =>
            setShowFuelModal(
              false
            )
          }
        >
          <div
            style={
              formGridStyle
            }
          >
            <div
              className="form-two-column"
              style={
                twoColumnStyle
              }
            >
              <Field label="Date">
                <input
                  type="date"
                  value={
                    fuelForm.fuelDate
                  }
                  onChange={(
                    event
                  ) =>
                    setFuelForm(
                      (
                        current
                      ) => ({
                        ...current,
                        fuelDate:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  style={
                    inputStyle
                  }
                />
              </Field>

              <Field label="Fuel Type">
                <select
                  value={
                    fuelForm.fuelType
                  }
                  onChange={(
                    event
                  ) =>
                    setFuelForm(
                      (
                        current
                      ) => ({
                        ...current,
                        fuelType:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  style={
                    inputStyle
                  }
                >
                  <option value="petrol">
                    Petrol
                  </option>

                  <option value="diesel">
                    Diesel
                  </option>

                  <option value="cng">
                    CNG
                  </option>

                  <option value="electric">
                    EV
                  </option>
                </select>
              </Field>
            </div>

            <Field label="Fuel Station">
              <input
                value={
                  fuelForm.fuelStation
                }
                onChange={(
                  event
                ) =>
                  setFuelForm(
                    (
                      current
                    ) => ({
                      ...current,
                      fuelStation:
                        event
                          .target
                          .value,
                    })
                  )
                }
                placeholder="Example: IndianOil"
                style={
                  inputStyle
                }
              />
            </Field>

            <div
              className="form-two-column"
              style={
                twoColumnStyle
              }
            >
              <Field label="Litres / Units">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    fuelForm.litres
                  }
                  onChange={(
                    event
                  ) =>
                    setFuelForm(
                      (
                        current
                      ) => ({
                        ...current,
                        litres:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  style={
                    inputStyle
                  }
                />
              </Field>

              <Field label="Amount Paid">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    fuelForm.totalAmount
                  }
                  onChange={(
                    event
                  ) =>
                    setFuelForm(
                      (
                        current
                      ) => ({
                        ...current,
                        totalAmount:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  style={
                    inputStyle
                  }
                />
              </Field>
            </div>

            <label
              style={
                checkboxLabelStyle
              }
            >
              <input
                type="checkbox"
                checked={
                  fuelForm.fullTank
                }
                onChange={(
                  event
                ) =>
                  setFuelForm(
                    (
                      current
                    ) => ({
                      ...current,
                      fullTank:
                        event
                          .target
                          .checked,
                    })
                  )
                }
              />

              Full Tank
            </label>

            <Field label="Notes">
              <textarea
                rows={3}
                value={
                  fuelForm.notes
                }
                onChange={(
                  event
                ) =>
                  setFuelForm(
                    (
                      current
                    ) => ({
                      ...current,
                      notes:
                        event
                          .target
                          .value,
                    })
                  )
                }
                style={{
                  ...inputStyle,
                  resize:
                    "vertical",
                }}
              />
            </Field>

            <SaveButton
              saving={saving}
              label={
                editingFuel
                  ? "Update Fuel Entry"
                  : "Save Fuel Entry"
              }
              onClick={saveFuel}
            />
          </div>
        </Modal>
      )}

      {showExpenseModal && (
        <Modal
          title={
            editingExpense
              ? "Edit Expense"
              : "Add Expense"
          }
          onClose={() =>
            setShowExpenseModal(
              false
            )
          }
        >
          <div
            style={
              formGridStyle
            }
          >
            <div
              className="form-two-column"
              style={
                twoColumnStyle
              }
            >
              <Field label="Date">
                <input
                  type="date"
                  value={
                    expenseForm.expenseDate
                  }
                  onChange={(
                    event
                  ) =>
                    setExpenseForm(
                      (
                        current
                      ) => ({
                        ...current,
                        expenseDate:
                          event
                            .target
                            .value,
                      })
                    )
                  }
                  style={
                    inputStyle
                  }
                />
              </Field>

              <Field label="Category">
                <select
                  value={
                    expenseForm.category
                  }
                  onChange={(
                    event
                  ) =>
                    setExpenseForm(
                      (
                        current
                      ) => ({
                        ...current,
                        category:
                          event
                            .target
                            .value as ExpenseCategory,
                      })
                    )
                  }
                  style={
                    inputStyle
                  }
                >
                  {EXPENSE_CATEGORIES.map(
                    (
                      category
                    ) => (
                      <option
                        key={
                          category.value
                        }
                        value={
                          category.value
                        }
                      >
                        {
                          category.label
                        }
                      </option>
                    )
                  )}
                </select>
              </Field>
            </div>

            <Field label="Title">
              <input
                value={
                  expenseForm.title
                }
                onChange={(
                  event
                ) =>
                  setExpenseForm(
                    (
                      current
                    ) => ({
                      ...current,
                      title:
                        event
                          .target
                          .value,
                    })
                  )
                }
                placeholder="Example: Periodic Service"
                style={
                  inputStyle
                }
              />
            </Field>

            <Field label="Amount">
              <input
                type="number"
                min="0"
                step="0.01"
                value={
                  expenseForm.amount
                }
                onChange={(
                  event
                ) =>
                  setExpenseForm(
                    (
                      current
                    ) => ({
                      ...current,
                      amount:
                        event
                          .target
                          .value,
                    })
                  )
                }
                style={
                  inputStyle
                }
              />
            </Field>

            <Field label="Notes">
              <textarea
                rows={3}
                value={
                  expenseForm.notes
                }
                onChange={(
                  event
                ) =>
                  setExpenseForm(
                    (
                      current
                    ) => ({
                      ...current,
                      notes:
                        event
                          .target
                          .value,
                    })
                  )
                }
                style={{
                  ...inputStyle,
                  resize:
                    "vertical",
                }}
              />
            </Field>

            <SaveButton
              saving={saving}
              label={
                editingExpense
                  ? "Update Expense"
                  : "Save Expense"
              }
              onClick={
                saveExpense
              }
            />
          </div>
        </Modal>
      )}
    </main>
  );
}

function Modal(props: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      onMouseDown={(
        event
      ) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          props.onClose();
        }
      }}
      style={
        modalOverlayStyle
      }
    >
      <section
        style={
          modalCardStyle
        }
      >
        <div
          style={
            modalHeaderStyle
          }
        >
          <h2>
            {props.title}
          </h2>

          <button
            type="button"
            onClick={
              props.onClose
            }
            style={
              closeButtonStyle
            }
          >
            <X size={17} />
          </button>
        </div>

        {props.children}
      </section>
    </div>
  );
}

function Field(props: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label>
      <span
        style={
          fieldLabelStyle
        }
      >
        {props.label}
      </span>

      {props.children}
    </label>
  );
}

function SaveButton(props: {
  saving: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        props.onClick
      }
      disabled={
        props.saving
      }
      style={{
        ...primaryButtonStyle,
        width: "100%",
        justifyContent:
          "center",
        opacity:
          props.saving
            ? 0.7
            : 1,
      }}
    >
      {props.saving ? (
        <Loader2
          size={18}
          style={{
            animation:
              "spin 1s linear infinite",
          }}
        />
      ) : (
        <CheckCircle2
          size={18}
        />
      )}

      {props.saving
        ? "Saving..."
        : props.label}
    </button>
  );
}

function RecordActions(props: {
  onEdit: () => void;
  onDelete: () => void;
  loading: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        flexWrap:
          "wrap",
      }}
    >
      <button
        type="button"
        onClick={
          props.onEdit
        }
        style={
          smallButtonStyle
        }
      >
        <Pencil
          size={15}
        />
        Edit
      </button>

      <button
        type="button"
        onClick={
          props.onDelete
        }
        style={
          dangerButtonStyle
        }
      >
        {props.loading ? (
          <Loader2
            size={15}
            style={{
              animation:
                "spin 1s linear infinite",
            }}
          />
        ) : (
          <Trash2
            size={15}
          />
        )}

        Delete
      </button>
    </div>
  );
}

function SummaryCard(props: {
  icon: typeof Fuel;
  label: string;
  value: string;
}) {
  const Icon =
    props.icon;

  return (
    <article
      style={
        summaryCardStyle
      }
    >
      <Icon
        size={19}
        color="#93c5fd"
      />

      <div
        style={
          summaryLabelStyle
        }
      >
        {props.label}
      </div>

      <div
        style={
          summaryValueStyle
        }
      >
        {props.value}
      </div>
    </article>
  );
}

function CategoryCard(props: {
  label: string;
  value: number;
}) {
  return (
    <article
      style={
        categoryCardStyle
      }
    >
      <div
        style={
          summaryLabelStyle
        }
      >
        {props.label}
      </div>

      <div
        style={{
          ...summaryValueStyle,
          fontSize: "19px",
        }}
      >
        {currency(
          props.value
        )}
      </div>
    </article>
  );
}

function EmptyRecords(props: {
  icon: typeof Fuel;
  title: string;
  description: string;
}) {
  const Icon =
    props.icon;

  return (
    <div style={emptyStyle}>
      <Icon
        size={39}
        color="#64748b"
      />

      <h3>
        {props.title}
      </h3>

      <p
        style={{
          color:
            "#94a3b8",
        }}
      >
        {props.description}
      </p>
    </div>
  );
}

const loadingPageStyle: React.CSSProperties = {
  minHeight: "100vh",
  display: "grid",
  placeItems: "center",
  background:
    "radial-gradient(circle at top, #172554 0%, #071426 42%, #020617 100%)",
  color: "white",
};

const pageStyle: React.CSSProperties = {
  minHeight: "100vh",
  padding: "28px 18px 72px",
  background:
    "radial-gradient(circle at top, #172554 0%, #071426 39%, #020617 100%)",
  color: "#f8fafc",
};

const topBarStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
  flexWrap: "wrap",
};

const secondaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "9px 12px",
  borderRadius: "11px",
  border: "1px solid rgba(148,163,184,0.18)",
  background: "rgba(15,23,42,0.62)",
  color: "#cbd5e1",
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "10px 14px",
  borderRadius: "11px",
  border: 0,
  background: "#2563eb",
  color: "white",
  fontWeight: 900,
  cursor: "pointer",
};

const eyebrowStyle: React.CSSProperties = {
  color: "#67e8f9",
  fontSize: "12px",
  fontWeight: 950,
  letterSpacing: "0.14em",
  textTransform: "uppercase",
};

const titleStyle: React.CSSProperties = {
  margin: "8px 0 7px",
  fontSize: "clamp(31px, 5vw, 48px)",
  letterSpacing: "-0.035em",
};

const descriptionStyle: React.CSSProperties = {
  margin: 0,
  maxWidth: "760px",
  color: "#94a3b8",
  lineHeight: 1.7,
};

const errorStyle: React.CSSProperties = {
  marginTop: "18px",
  padding: "14px 16px",
  borderRadius: "14px",
  background: "rgba(127,29,29,0.18)",
  border: "1px solid rgba(248,113,113,0.23)",
  color: "#fecaca",
  display: "flex",
  gap: "9px",
};

const successStyle: React.CSSProperties = {
  marginTop: "18px",
  padding: "14px 16px",
  borderRadius: "14px",
  background: "rgba(22,163,74,0.12)",
  border: "1px solid rgba(134,239,172,0.2)",
  color: "#bbf7d0",
  display: "flex",
  gap: "9px",
};

const emptyStyle: React.CSSProperties = {
  marginTop: "24px",
  padding: "38px 24px",
  borderRadius: "22px",
  background: "rgba(15,23,42,0.86)",
  border: "1px solid rgba(148,163,184,0.14)",
  textAlign: "center",
};

const vehicleSelectorStyle: React.CSSProperties = {
  marginTop: "22px",
  padding: "16px",
  borderRadius: "17px",
  background: "rgba(15,23,42,0.82)",
  border: "1px solid rgba(148,163,184,0.14)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "14px",
  flexWrap: "wrap",
};

const vehicleSelectStyle: React.CSSProperties = {
  minWidth: "220px",
  appearance: "none",
  padding: "11px 38px 11px 13px",
  borderRadius: "11px",
  border: "1px solid rgba(148,163,184,0.18)",
  background: "#071426",
  color: "white",
  cursor: "pointer",
};

const selectArrowStyle: React.CSSProperties = {
  position: "absolute",
  right: "12px",
  top: "50%",
  transform: "translateY(-50%)",
  pointerEvents: "none",
  color: "#94a3b8",
};

const mutedSmallStyle: React.CSSProperties = {
  marginTop: "3px",
  color: "#94a3b8",
  fontSize: "12px",
};

const summaryGridStyle: React.CSSProperties = {
  marginTop: "16px",
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: "12px",
};

const summaryCardStyle: React.CSSProperties = {
  padding: "16px",
  borderRadius: "16px",
  background: "rgba(15,23,42,0.82)",
  border: "1px solid rgba(148,163,184,0.14)",
};

const summaryLabelStyle: React.CSSProperties = {
  marginTop: "12px",
  color: "#94a3b8",
  fontSize: "11px",
  fontWeight: 850,
};

const summaryValueStyle: React.CSSProperties = {
  marginTop: "5px",
  fontSize: "21px",
  fontWeight: 950,
};

const categoryGridStyle: React.CSSProperties = {
  marginTop: "12px",
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(180px, 1fr))",
  gap: "12px",
};

const categoryCardStyle: React.CSSProperties = {
  padding: "14px",
  borderRadius: "15px",
  background: "rgba(8,47,73,0.18)",
  border: "1px solid rgba(103,232,249,0.13)",
};

const tabBarStyle: React.CSSProperties = {
  marginTop: "18px",
  display: "flex",
  gap: "8px",
  flexWrap: "wrap",
};

const activeTabStyle: React.CSSProperties = {
  ...primaryButtonStyle,
};

const inactiveTabStyle: React.CSSProperties = {
  ...secondaryButtonStyle,
};

const searchIconStyle: React.CSSProperties = {
  position: "absolute",
  left: "13px",
  top: "50%",
  transform: "translateY(-50%)",
  color: "#64748b",
};

const searchInputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 13px 12px 42px",
  borderRadius: "12px",
  border: "1px solid rgba(148,163,184,0.16)",
  background: "rgba(15,23,42,0.78)",
  color: "white",
  outline: "none",
};

const filterSelectStyle: React.CSSProperties = {
  width: "100%",
  appearance: "none",
  padding: "12px 38px 12px 13px",
  borderRadius: "12px",
  border: "1px solid rgba(148,163,184,0.16)",
  background: "rgba(15,23,42,0.78)",
  color: "white",
  cursor: "pointer",
};

const recordCardStyle: React.CSSProperties = {
  padding: "18px",
  borderRadius: "18px",
  background: "rgba(15,23,42,0.82)",
  border: "1px solid rgba(148,163,184,0.14)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "16px",
  flexWrap: "wrap",
};

const recordLeftStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "13px",
  minWidth: 0,
  flex: "1 1 520px",
};

const fuelIconStyle: React.CSSProperties = {
  width: "46px",
  height: "46px",
  borderRadius: "14px",
  display: "grid",
  placeItems: "center",
  background: "rgba(22,163,74,0.12)",
  color: "#86efac",
  flexShrink: 0,
};

const expenseIconStyle: React.CSSProperties = {
  ...fuelIconStyle,
  background: "rgba(124,58,237,0.12)",
  color: "#c4b5fd",
};

const recordTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: "17px",
};

const titleRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "8px",
  flexWrap: "wrap",
};

const categoryPillStyle: React.CSSProperties = {
  padding: "5px 8px",
  borderRadius: "999px",
  background: "rgba(37,99,235,0.12)",
  color: "#93c5fd",
  fontSize: "9px",
  fontWeight: 950,
};

const recordDescriptionStyle: React.CSSProperties = {
  margin: "7px 0 0",
  color: "#94a3b8",
  fontSize: "12px",
};

const metaStyle: React.CSSProperties = {
  marginTop: "10px",
  display: "flex",
  gap: "13px",
  flexWrap: "wrap",
  color: "#cbd5e1",
  fontSize: "11px",
};

const notesStyle: React.CSSProperties = {
  margin: "10px 0 0",
  color: "#94a3b8",
  fontSize: "12px",
  lineHeight: 1.6,
};

const smallButtonStyle: React.CSSProperties = {
  padding: "9px 11px",
  borderRadius: "10px",
  border: "1px solid rgba(147,197,253,0.2)",
  background: "rgba(37,99,235,0.12)",
  color: "#bfdbfe",
  fontWeight: 850,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const dangerButtonStyle: React.CSSProperties = {
  padding: "9px 11px",
  borderRadius: "10px",
  border: "1px solid rgba(248,113,113,0.2)",
  background: "rgba(127,29,29,0.13)",
  color: "#fca5a5",
  fontWeight: 850,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
};

const miraStyle: React.CSSProperties = {
  marginTop: "18px",
  padding: "17px",
  borderRadius: "18px",
  background:
    "linear-gradient(145deg, rgba(30,41,59,0.8), rgba(15,23,42,0.84))",
  border: "1px solid rgba(167,139,250,0.18)",
  display: "flex",
  gap: "11px",
  alignItems: "flex-start",
};

const miraTextStyle: React.CSSProperties = {
  marginTop: "5px",
  color: "#cbd5e1",
  fontSize: "12px",
  lineHeight: 1.65,
};

const miraFormStyle: React.CSSProperties = {
  marginTop: "12px",
  display: "flex",
  gap: "10px",
  flexWrap: "wrap",
};

const miraInputStyle: React.CSSProperties = {
  flex: "1 1 320px",
  padding: "11px 12px",
  borderRadius: "11px",
  border: "1px solid rgba(148,163,184,0.17)",
  background: "#071426",
  color: "white",
  outline: "none",
};

const modalOverlayStyle: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 1000,
  padding: "20px",
  background: "rgba(2,6,23,0.78)",
  backdropFilter: "blur(8px)",
  display: "grid",
  placeItems: "center",
};

const modalCardStyle: React.CSSProperties = {
  width: "min(640px, 100%)",
  maxHeight: "90vh",
  overflowY: "auto",
  padding: "22px",
  borderRadius: "22px",
  background: "linear-gradient(145deg, #0f172a, #071426)",
  border: "1px solid rgba(148,163,184,0.17)",
  boxShadow: "0 30px 90px rgba(0,0,0,0.45)",
};

const modalHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: "12px",
};

const closeButtonStyle: React.CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "11px",
  border: "1px solid rgba(148,163,184,0.16)",
  background: "rgba(15,23,42,0.8)",
  color: "#cbd5e1",
  cursor: "pointer",
  display: "grid",
  placeItems: "center",
};

const formGridStyle: React.CSSProperties = {
  marginTop: "18px",
  display: "grid",
  gap: "14px",
};

const twoColumnStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns:
    "repeat(2, minmax(0, 1fr))",
  gap: "12px",
};

const fieldLabelStyle: React.CSSProperties = {
  display: "block",
  marginBottom: "7px",
  color: "#cbd5e1",
  fontSize: "12px",
  fontWeight: 850,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "12px 13px",
  borderRadius: "11px",
  border: "1px solid rgba(148,163,184,0.17)",
  background: "#071426",
  color: "white",
  outline: "none",
};

const checkboxLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "9px",
  color: "#cbd5e1",
  fontSize: "12px",
};