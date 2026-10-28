mock_provider "aws" {}

variables {
  repositorio_github = "AngelTR09/historial-clinico-mascotas"
  arn_bucket_estado  = "arn:aws:s3:::hcm-tfstate-123456789012-us-east-2"
  arn_clave_estado   = "arn:aws:kms:us-east-2:123456789012:key/11111111-2222-3333-4444-555555555555"
}

run "plan_solo_para_pull_requests" {
  command = plan

  assert {
    condition     = strcontains(aws_iam_role.plan.assume_role_policy, "repo:AngelTR09/historial-clinico-mascotas:pull_request") && !strcontains(aws_iam_role.plan.assume_role_policy, "environment")
    error_message = "El rol de plan debe confiar solo en los pull_request del repositorio."
  }

  assert {
    condition     = aws_iam_role_policy_attachment.plan_lectura.policy_arn == "arn:aws:iam::aws:policy/ReadOnlyAccess"
    error_message = "El rol de plan debe ser de solo lectura."
  }
}

run "el_despliegue_solo_lo_asume_el_environment_dev" {
  command = plan

  assert {
    condition     = strcontains(aws_iam_role.despliegue.assume_role_policy, "repo:AngelTR09/historial-clinico-mascotas:environment:dev")
    error_message = "El rol de despliegue debe confiar en el environment dev del repositorio."
  }

  assert {
    condition     = !strcontains(aws_iam_role.despliegue.assume_role_policy, "ref:refs/heads") && !strcontains(aws_iam_role.despliegue.assume_role_policy, "pull_request")
    error_message = "No se mezcla el formato de rama ni el de pull_request con el environment: dejaría entrar a otros jobs."
  }

  assert {
    condition     = !strcontains(aws_iam_role.despliegue.assume_role_policy, "*")
    error_message = "La confianza del rol de despliegue no debe usar comodines."
  }

  assert {
    condition     = jsondecode(aws_iam_role.despliegue.assume_role_policy).Statement[0].Condition.StringEquals["token.actions.githubusercontent.com:sub"] == "repo:AngelTR09/historial-clinico-mascotas:environment:dev"
    error_message = "El sub debe ser exactamente uno: el del environment dev."
  }
}

run "el_despliegue_no_usa_administratoraccess" {
  command = plan

  assert {
    condition     = aws_iam_role_policy_attachment.despliegue.role == "lab09-github-actions-dev" && !strcontains(aws_iam_policy.despliegue.policy, "AdministratorAccess")
    error_message = "El rol de despliegue usa una política administrada propia, no AdministratorAccess."
  }

  assert {
    condition     = alltrue([for st in jsondecode(aws_iam_policy.despliegue.policy).Statement : !(st.Effect == "Allow" && (st.Action == "*" || try(contains(st.Action, "*"), false)))])
    error_message = "Ninguna sentencia puede conceder todas las acciones."
  }

  assert {
    condition     = length(aws_iam_policy.despliegue.policy) < 6144
    error_message = "Una política administrada de IAM no puede pasar de 6144 caracteres."
  }
}

run "el_estado_solo_se_toca_bajo_su_prefijo" {
  command = plan

  assert {
    condition = anytrue([
      for st in jsondecode(aws_iam_policy.despliegue.policy).Statement :
      st.Sid == "ListarEstadoDelPrefijo" && contains(st.Condition.StringLike["s3:prefix"], "lab09/dev") && contains(st.Condition.StringLike["s3:prefix"], "lab09/dev/*")
    ])
    error_message = "s3:ListBucket debe limitarse al prefijo del estado (lab09/dev/)."
  }

  assert {
    condition = anytrue([
      for st in jsondecode(aws_iam_policy.despliegue.policy).Statement :
      st.Sid == "LeerYEscribirElEstado" && st.Resource == "arn:aws:s3:::hcm-tfstate-123456789012-us-east-2/lab09/dev/terraform.tfstate"
      ]) && anytrue([
      for st in jsondecode(aws_iam_policy.despliegue.policy).Statement :
      st.Sid == "CrearYBorrarElArchivoDeBloqueo" && st.Resource == "arn:aws:s3:::hcm-tfstate-123456789012-us-east-2/lab09/dev/terraform.tfstate.tflock" && contains(st.Action, "s3:DeleteObject")
    ])
    error_message = "El estado y su archivo de bloqueo son los únicos objetos del bucket de estado que se escriben, y el bloqueo se puede crear y borrar."
  }

  assert {
    condition = alltrue([
      for st in jsondecode(aws_iam_policy.despliegue.policy).Statement :
      !(st.Effect == "Allow" && try(contains(tolist(st.Resource), "arn:aws:s3:::hcm-tfstate-123456789012-us-east-2/*"), false))
    ])
    error_message = "Ninguna sentencia puede dar acceso a todo el bucket de estado."
  }
}

run "passrole_solo_a_roles_del_proyecto_y_a_ecs_lambda_y_backup" {
  command = plan

  assert {
    condition = anytrue([
      for st in jsondecode(aws_iam_policy.despliegue.policy).Statement :
      try(st.Action == "iam:PassRole", false) && endswith(st.Resource, ":role/hcm-*") && contains(st.Condition.StringEquals["iam:PassedToService"], "lambda.amazonaws.com") && !contains(st.Condition.StringEquals["iam:PassedToService"], "ec2.amazonaws.com")
    ])
    error_message = "iam:PassRole se limita a los roles del proyecto y a los servicios que los usan."
  }

  assert {
    condition = anytrue([
      for st in jsondecode(aws_iam_policy.despliegue.policy).Statement :
      st.Sid == "AdjuntarSoloPoliticasPermitidas" && length(st.Condition.ArnEquals["iam:PolicyARN"]) == 5
    ])
    error_message = "Solo se pueden adjuntar a los roles del proyecto las cinco políticas administradas de la lista."
  }
}

run "el_despliegue_puede_leer_las_etiquetas_de_sus_roles" {
  command = plan

  assert {
    condition = anytrue([
      for st in jsondecode(aws_iam_policy.despliegue.policy).Statement :
      st.Sid == "RolesDelProyecto" && contains(st.Action, "iam:ListRoleTags") && contains(st.Action, "iam:TagRole")
    ])
    error_message = "El proveedor de Terraform lee las etiquetas de cada rol: sin iam:ListRoleTags el apply falla al refrescar."
  }
}

run "los_servicios_regionales_solo_en_la_region_del_laboratorio" {
  command = plan

  assert {
    condition = anytrue([
      for st in jsondecode(aws_iam_policy.despliegue.policy).Statement :
      st.Sid == "ServiciosRegionalesDelStack" && st.Condition.StringEquals["aws:RequestedRegion"] == "us-east-2"
    ])
    error_message = "Los servicios regionales solo se permiten en us-east-2."
  }
}

run "el_plan_solo_escribe_archivos_de_bloqueo_y_lee_la_configuracion" {
  command = plan

  assert {
    condition = anytrue([
      for st in jsondecode(aws_iam_role_policy.plan_estado.policy).Statement :
      st.Effect == "Allow" && contains(try(tolist(st.Action), [st.Action]), "s3:PutObject") && st.Resource == "arn:aws:s3:::hcm-tfstate-123456789012-us-east-2/lab09/*.tflock"
    ])
    error_message = "El rol de plan debe poder escribir el archivo de bloqueo (use_lockfile) bajo la raíz del estado."
  }

  assert {
    condition = alltrue([
      for st in jsondecode(aws_iam_role_policy.plan_estado.policy).Statement :
      !(st.Effect == "Allow" && contains(try(tolist(st.Action), [st.Action]), "s3:PutObject") && st.Resource != "arn:aws:s3:::hcm-tfstate-123456789012-us-east-2/lab09/*.tflock")
    ])
    error_message = "El rol de plan no puede escribir nada más que los *.tflock."
  }

  assert {
    condition = anytrue([
      for st in jsondecode(aws_iam_role_policy.plan_estado.policy).Statement :
      st.Sid == "NoLeerOtrosParametros" && st.Effect == "Deny" && endswith(st.NotResource, ":parameter/hcm/*")
    ])
    error_message = "El plan debe poder leer los parámetros de configuración del proyecto (Terraform los refresca) y ningún otro."
  }
}

run "con_identificador_inmutable_solo_confia_en_ese_prefijo" {
  command = plan

  variables {
    prefijo_sub_github = "repo:AngelTR09@235907005/historial-clinico-mascotas@1408882331"
  }

  assert {
    condition     = strcontains(aws_iam_role.plan.assume_role_policy, "repo:AngelTR09@235907005/historial-clinico-mascotas@1408882331:pull_request")
    error_message = "El rol de plan debe confiar en el sub con identificador inmutable."
  }

  assert {
    condition     = strcontains(aws_iam_role.despliegue.assume_role_policy, "repo:AngelTR09@235907005/historial-clinico-mascotas@1408882331:environment:dev")
    error_message = "El rol de despliegue debe confiar en el environment dev con el mismo prefijo inmutable."
  }

  assert {
    condition     = !strcontains(aws_iam_role.plan.assume_role_policy, "repo:AngelTR09/historial-clinico-mascotas") && !strcontains(aws_iam_role.despliegue.assume_role_policy, "repo:AngelTR09/historial-clinico-mascotas")
    error_message = "Con identificador inmutable no se acepta el sub clásico por nombre: un repositorio recreado con el mismo nombre podría usarlo."
  }
}

run "rechaza_un_prefijo_con_comodin" {
  command = plan

  variables {
    prefijo_sub_github = "repo:AngelTR09@*/historial-clinico-mascotas@*"
  }

  expect_failures = [var.prefijo_sub_github]
}

run "rechaza_environment_con_comodin" {
  command = plan

  variables {
    entorno_despliegue = "dev*"
  }

  expect_failures = [var.entorno_despliegue]
}

run "rechaza_prefijo_de_estado_con_comodin" {
  command = plan

  variables {
    prefijo_estado = "lab09/*"
  }

  expect_failures = [var.prefijo_estado]
}

run "rechaza_repositorio_mal_formado" {
  command = plan

  variables {
    repositorio_github = "solo-un-nombre"
  }

  expect_failures = [var.repositorio_github]
}
