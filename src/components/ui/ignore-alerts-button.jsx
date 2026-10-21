import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { MdNotificationsOff, MdNotificationsActive } from "react-icons/md";
import {
  selectIgnoreAlerts,
  toggleIgnoreAlerts,
} from "../../redux/slices/alertsSlice";

export function IgnoreAlertsButton({ collapsed }) {
  const dispatch = useDispatch();
  const isIgnored = useSelector(selectIgnoreAlerts);

  const toggleIgnore = () => {
    dispatch(toggleIgnoreAlerts());
  };

  const Icon = isIgnored ? (
    <MdNotificationsActive size={20} className="text-amber-500 dark:text-amber-400" />
  ) : (
    <MdNotificationsOff size={20} />
  );

  const label = isIgnored ? "Show Alerts" : "Ignore Alerts";
  const buttonTitle = isIgnored
    ? "Alerts ignored. Click to show alerts"
    : "Ignore alerts across page refreshes";

  return (
    <button
      onClick={toggleIgnore}
      title={buttonTitle}
      aria-label={label}
      aria-pressed={isIgnored}
      className={`flex items-center gap-3 text-sm px-3 py-2 rounded-md w-full transition ${
        isIgnored
          ? "bg-amber-100/70 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 font-medium"
          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
      }`}
    >
      <span className="text-xl">{Icon}</span>
      {!collapsed && <span>{label}</span>}
    </button>
  );
}

export default IgnoreAlertsButton;
